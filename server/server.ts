
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

import express from 'express';

import './config';

import WsServer from './ws-server';
import { makeDebug } from './utility';
import setupAuthentication from './authentication';

const debug = makeDebug('server');

const app = express()

//-----------------------------------------------------------------------------

app.set('x-powered-by', false);

//-----------------------------------------------------------------------------

app.use(express.urlencoded({extended: true}));
app.use(express.json({limit: '1mb'}));

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
    return http.createServer(app).listen(PORT, () => {
        console.log(`fortee2 ready with http at port ${PORT}`);
    });
}


const server = createServer();

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

