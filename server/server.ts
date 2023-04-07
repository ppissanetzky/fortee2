
import fs from 'node:fs';

import express, { Request } from 'express';

import config from './config';
import WsServer from './ws-server';
import { expected, makeDebug } from './utility';
import setupAuthentication from './authentication';
import connectToSlack from './slack';
import { slackAuth } from './slack-authentication';
import GameRoom from './game-room';
import { Rules } from './core';
import { TableBuilder, User } from './table-helper';
import { HttpServer } from './http-server';

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

if (fs.existsSync('./site')) {
    app.use(express.static('./site'));
}
else {
    debug('Not serving static site');
}

//-----------------------------------------------------------------------------

setupAuthentication(app);

//-----------------------------------------------------------------------------

/**
 * For testing - logs me in, creates a room and redirects to play
 */

if (!config.PRODUCTION) {
    app.get('/api/test-game/:players', async (req, res) => {
        const names: (User | null)[] = req.params.players.split(',')
            .map((name) => ({id:`test/${name}` , name}));
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
        const room = new GameRoom(new Rules(), table);
        req.session.gameRoomToken = room.token;
        await saveSession(req);
        res.redirect(`/play-rob`);
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
            req.login({id: `test/${name}`, name},
                (error) => error ? reject(error) : resolve());
        });
        req.session.gameRoomToken = room.token;
        await saveSession(req);
        res.json({token: room.token});
    });
}

app.get('/game/:token', slackAuth, async (req, res) => {
    const { params: { token } } = req;
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
    /** Save the token in the session and save the session */

    req.session.gameRoomToken = token;

    await saveSession(req);

    res.redirect(`/play`);
});

/**
 * This one will only allow requests that have a user, otherwise it's a 401
 */

app.use((req, res, next) => {
    debug('%o', req.user);
    if (req.isUnauthenticated()) {
        debug('unauthenticated', req.url);
        return res.sendStatus(401);
    }
    next();
});

/** Create the web server */

HttpServer.create(app);

/** Create the WebSocket server */

WsServer.create(app);

/** Connect to Slack */

connectToSlack();
