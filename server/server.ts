
import fs from 'node:fs';
import http from 'node:http';

import express from 'express';
import Session from 'express-session';

import './config';

import WsServer from './ws-server';
import { makeDebug, makeToken } from './utility';
import setupAuthentication from './authentication';

const debug = makeDebug('server');

const app = express()

//-----------------------------------------------------------------------------

app.set('trust proxy', 1);
app.set('x-powered-by', false);

app.disable('etag');

//-----------------------------------------------------------------------------

app.use(express.urlencoded({extended: true}));
app.use(express.json({limit: '5mb'}));

//-----------------------------------------------------------------------------

app.use((req, res, next) => {
    debug(req.method, req.url, req.get('content-length') || '');
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

const sessionParser = Session({
    saveUninitialized: false,
    secret: makeToken(32),
    resave: false,
    // cookie: {
    //     // Don't know if this is needed in order to have the browser
    //     // send the cookie
    //     // httpOnly: false
    // }
});

// Data we attach to the session

declare module 'express-session' {
    interface SessionData {
        name: string;
        userId: string;
    }
}

app.use(sessionParser);

//-----------------------------------------------------------------------------

setupAuthentication(app);

//-----------------------------------------------------------------------------

/**
 * Our awesome user database
 */

const users = new Map([
    'pablo', 'bubba'
].map((name) => ([name, makeToken(16)])));

app.get('/login/:name', (req, res) => {
    const { session, params: { name } } = req;
    if (!session.name) {
        const userId = users.get(name);
        if (!userId) {
            debug('invalid user', name);
            return res.sendStatus(401);
        }
        session.name = name;
        session.userId = userId;
    }
    res.sendStatus(200);
});

//-----------------------------------------------------------------------------
// The port that the Express application listens to
//-----------------------------------------------------------------------------

const PORT = process.env.FT_PORT || '4004';

//-----------------------------------------------------------------------------
// Start listening
//-----------------------------------------------------------------------------

const server = http.createServer(app).listen(PORT, () => {
    console.log(`FortyTwo ready at http://localhost:${PORT}`);
});

//-----------------------------------------------------------------------------
// Create the WebSocket server
//-----------------------------------------------------------------------------

const wss = new WsServer();

/**
 * This is the event on the HTTP server (not Express) that we get when
 * a WebSocket wants to uprade (connect). We check the URL, which should be
 * "/ws" and then route it to Express.
 */

server.on('upgrade', (request) => {
    debug('upgrade', request.headers);
    if (request.url !== '/ws') {
        debug(`upgrade at wrong url "${request.url}"`);
        request.socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        request.socket.destroy();
        return;
    }
    app(request, new http.ServerResponse(request));
});

/**
 * And this is where WebSocket upgrade requests end up being routed
 */

app.get('/ws', async (req, res) => {
    await wss.upgrade(req);
    res.end();
});

//-----------------------------------------------------------------------------
// Graceful shutdown for docker
//-----------------------------------------------------------------------------

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

