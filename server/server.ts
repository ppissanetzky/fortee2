
import fs from 'node:fs';
import assert from 'node:assert';

import _ from 'lodash';

import express, { NextFunction, Request, Response } from 'express';

import config from './config';
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
import Socket from './socket';

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

if (fs.existsSync('./site')) {
    app.use(express.static('./site'));
}
else {
    debug('Not serving static site');
}

//-----------------------------------------------------------------------------

setupAuthentication(app);

//-----------------------------------------------------------------------------

app.use((req, res, next) => {
    debug('%s %s %s %j %s %j',
        req.method,
        req.socket.remoteAddress,
        req.url,
        req.headers,
        req.session?.id,
        req.session);

    res.once('finish', () => {
        debug('%s %s %s %d %j %s %j',
        req.method,
        req.socket.remoteAddress,
        req.url,
        res.statusCode,
        res.getHeaders(),
        req.session?.id,
        req.session);
    });
    next();
});

/**
 * This one takes the user from
 * session.passport.user and deserializes it, placing the result in req.user
 */

app.use(passport.authenticate('session'));

//-----------------------------------------------------------------------------

if (!config.PRODUCTION) {
    app.use((req, res, next) => {
        if (!req.isAuthenticated()) {
            const bot = req.header('x-ft2-bot');
            if (bot) {
                return req.login({id: bot, name: bot}, () => next());
            }
            return req.login({id: 'pablo', name: 'pablo'}, () => next());
        }
        next();
    });
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
        const {url} = new GameRoom({
            rules: new Rules(),
            table
        });
        res.redirect(url);
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
    res.sendStatus(401);
});

/**
 * The route used to play a game. It checks that everything is sane and then
 * saves the game room token in the session so the WS has it implicitly
 * when it connects. Finally, it redirects to the '/play' page.
 */

app.get('/play/:token', async (req, res) => {
    return res.sendStatus(404);
    // const { token } = req.params;
    // debug('token', token);
    // if (!token) {
    //     return res.sendStatus(400);
    // }
    // const room = GameRoom.rooms.get(token);
    // if (!room) {
    //     return res.sendStatus(404);
    // }
    // if (!req.user) {
    //     return res.sendStatus(401);
    // }
    // if (!room.table.has(req.user.id)) {
    //     return res.sendStatus(403);
    // }
    // req.session.gameRoomToken = token;
    // await saveSession(req);
    // if (!config.PRODUCTION) {
    //     return res.redirect(`${config.FT2_SITE_BASE_URL}/play`);
    // }
    // res.redirect('/play')
});

/** Create the web server */

HttpServer.create(app);

/** Connect to Slack */

connectToSlack();

/** Where the game room sockets connect */

app.get('/join/:token', Socket.upgrade());

app.get('/watch/:token', Socket.watch());

/** The tournaments router */

app.use('/api/tournaments', tournamentRouter);
