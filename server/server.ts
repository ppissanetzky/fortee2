
import fs from 'node:fs';
import assert from 'node:assert';

import _ from 'lodash';

import express, { NextFunction, Request, Response } from 'express';

import config from './config';
import WsServer from './ws-server';
import { expected, makeDebug } from './utility';
import setupAuthentication from './authentication';
import connectToSlack from './slack';
import * as slack from './slack-authentication';
import GameRoom from './game-room';
import { Rules } from './core';
import { TableBuilder, User } from './table-helper';
import { HttpServer } from './http-server';
import passport from 'passport';
import tournamentRouter from './tournament-router';

const debug = makeDebug('server');

async function saveSession(req: Request) {
    debug('saving session %j', req.session);
    return new Promise<void>((resolve, reject) => {
        req.session.save((error) => error ? reject(error) : resolve());
    });
}

const app = express()

//-----------------------------------------------------------------------------

app.set('x-powered-by', false);

//-----------------------------------------------------------------------------

app.use(express.urlencoded({extended: true, limit: '20kb'}));
app.use(express.json({limit: '20kb'}));

//-----------------------------------------------------------------------------

app.use((req, res, next) => {
    debug('%s %s %j', req.method, req.url, req.headers);
    res.once('finish', () => {
        debug(req.method, req.url, res.statusCode);
    });
    next();
});

//-----------------------------------------------------------------------------

setupAuthentication(app);

/**
 * This one takes the user from
 * session.passport.user and deserializes it, placing the result in req.user
 */

app.use(passport.authenticate('session'));

//-----------------------------------------------------------------------------

// if (!config.PRODUCTION) {
//     app.use((req, res, next) => {
//         if (!req.isAuthenticated()) {
//             return req.login({id: 'pablo', name: 'pablo'}, () => next());
//         }
//         next();
//     });
// }

//-----------------------------------------------------------------------------

if (fs.existsSync('./site')) {
    app.use(express.static('./site'));
}
else {
    debug('Not serving static site');
}

//-----------------------------------------------------------------------------

/**
 * For testing - logs me in, creates a room and redirects to play
 */

if (!config.PRODUCTION) {
    app.get('/api/test-game/:players', async (req, res) => {
        const names: (User | null)[] = req.params.players.split(',')
            .map((name) => ({id: name , name}));
        while (names.length < 4) {
            names.push(null);
        }
        const table = new TableBuilder(names);
        await new Promise<void>((resolve, reject) => {
            const host = expected(table.host);
            const id = expected(host.id);
            const name = expected(host.name);
            req.login({id, name}, (error) => error ? reject(error) : resolve());
        });
        const s = JSON.stringify({
            renege: true,
            all_pass: 'FORCE',
            min_bid: '1-mark',
            forced_min_bid: '1-mark',
            plunge_allowed: true,
            plunge_min_marks: 2,
            plunge_max_marks: 2,
            sevens_allowed: true,
            nello_allowed: 'FORCE'
        });
        const rules = Rules.fromJson(s);
        const room = new GameRoom({
            rules: new Rules(),
            table
        });
        req.session.gameRoomToken = room.token;
        await saveSession(req);
        res.redirect(`/play`);
    });
    app.get('/api/join/:name', async (req, res) => {
        const name = req.params.name;
        const room = Array.from(GameRoom.rooms.values())
            .find((room) => room.invited.has(name));
        if (!room) {
            debug('No room for', name);
            return res.sendStatus(404);
        }
        await new Promise<void>((resolve, reject) => {
            req.login({id: name, name},
                (error) => error ? reject(error) : resolve());
        });
        req.session.gameRoomToken = room.token;
        await saveSession(req);
        res.json({token: room.token});
    });
}

/**
 * If the request is authenticated, redirects to the URI, otherwise, it
 * saves the URI in the session and calls the next handler
 */

async function redirectTo(uri: string, req: Request, res: Response, next: NextFunction) {
    assert(uri);
    if (req.isAuthenticated()) {
        return res.redirect(uri);
    }
    req.session.redirect = uri;
    await saveSession(req);
    debug('saved redirect "%s"', uri);
    next();
}

/** Redirects to the URI in req.session.redirect, deleting it */

async function redirectFromSession(req: Request, res: Response) {
    const { redirect } = req.session;
    if (!redirect) {
        return res.sendStatus(400);
    }
    delete req.session.redirect;
    await saveSession(req);
    debug('redirecting to "%s"', redirect);
    res.redirect(redirect);
}

/** The entry point for a Discord game link */

app.get('/discord/game/:token',
    (req, res, next) => redirectTo(`/play/${req.params.token}`, req, res, next),
    passport.authenticate('oauth2'));

app.get('/discord/authenticated',
    passport.authenticate('oauth2', {keepSessionInfo: true}),
    redirectFromSession);

/** Generic redirect to the 'to' query parameter after Slack auth */

app.get('/slack/redirect', 
    (req, res, next) => {
        const { to } = req.query;
        if (!(to && _.isString(to))) {
            return res.sendStatus(400);
        }
        redirectTo(to, req, res, next);
    },
    slack.authenticate);

app.get('/slack/authenticated',
    slack.authenticated,
    redirectFromSession);

/**
 * This one will only allow requests that have a user, otherwise it's a 401
 */

app.use((req, res, next) => {
    debug('%o', req.user);
    if (req.isAuthenticated()) {
        return next();
    }
    debug('unauthenticated', req.url);
    return res.sendStatus(401);
});

/**
 * The route used to play a game. It checks that everything is sane and then
 * saves the game room token in the session so the WS has it implicitly
 * when it connects. Finally, it redirects to the '/play' page.
 */

app.get('/play/:token', async (req, res) => {
    const { token } = req.params;
    debug('token', token);
    if (!token) {
        return res.sendStatus(400);
    }
    const room = GameRoom.rooms.get(token);
    if (!room) {
        return res.sendStatus(404);
    }
    if (!req.user) {
        return res.sendStatus(401);
    }
    if (!room.table.has(req.user.id)) {
        return res.sendStatus(403);
    }
    req.session.gameRoomToken = token;
    await saveSession(req);
    res.redirect('/play')
});

/** Create the web server */

HttpServer.create(app);

/** Create the WebSocket server */

WsServer.create(app);

/** Connect to Slack */

connectToSlack();

app.use('/api/tournaments', tournamentRouter);
