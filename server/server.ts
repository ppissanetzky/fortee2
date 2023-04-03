
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

import express from 'express';

import config from './config';

import WsServer from './ws-server';
import { makeDebug } from './utility';
import setupAuthentication from './authentication';
import connectToSlack from './slack';
import { setupSlackAuthentication } from './slack-authentication';
import GameRoom from './game-room';
import { Rules } from './core';

const debug = makeDebug('server');

const app = express()

//-----------------------------------------------------------------------------

app.set('x-powered-by', false);

//-----------------------------------------------------------------------------

app.use(express.urlencoded({extended: true, limit: '20kb'}));
app.use(express.json({limit: '20kb'}));

//-----------------------------------------------------------------------------

app.use((req, res, next) => {
    debug(req.method, req.url, req.get('content-length') || '');
    debug('%o', req.headers);
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

setupSlackAuthentication(app);

/**
 * For testing - logs me in, creates a room and redirects to play
 */

if (!config.PRODUCTION) {
    app.get('/api/test-game', async (req, res) => {
        const name = 'Pablo Test';
        await new Promise<void>((resolve, reject) => {
            req.login({id: 'test/pablo', name},
                (error) => error ? reject(error) : resolve());
        });
        const room = new GameRoom(new Rules(), name);
        res.redirect(`${config.FT2_SITE_BASE_URL}/play?t=${room.token}`);
    });
}

/**
 * This one will only allow requests that have a user, otherwise it's a 401
 */

app.use((req, res, next) => {
    if (req.isUnauthenticated()) {
        return res.sendStatus(401);
    }
    next();
});

//-----------------------------------------------------------------------------
// Start listening
//-----------------------------------------------------------------------------

function createServer() {
    const PORT = process.env.FT_PORT || '4004';
    if (PORT === '443') {
        return https.createServer({
            key: fs.readFileSync('./certs/privkey.pem'),
            cert: fs.readFileSync('./certs/fullchain.pem'),
        }, app)
        .listen(PORT, () => console.log(`fortee2 ready with https at port ${PORT}`));
    }
    if (config.PRODUCTION) {
        console.error('Not starting HTTP server in production');
        return process.exit(1);
    }
    return http.createServer(app).listen(PORT, () => {
        console.log(`fortee2 ready with http at port ${PORT}`);
    });
}


const server = createServer();

connectToSlack();

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

