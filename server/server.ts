
import fs from 'node:fs';

import express from 'express';

import WsServer from './ws-server';
import { makeDebug } from './utility';

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
// The port that the Express application listens to
//-----------------------------------------------------------------------------

const PORT = process.env.FT_PORT || '4004';

//-----------------------------------------------------------------------------
// Start listening
//-----------------------------------------------------------------------------

const server = app.listen(PORT, async () => {
    console.log(`FortyTwo ready at http://localhost:${PORT}`);
});

//-----------------------------------------------------------------------------
// Create the WebSocket server
//-----------------------------------------------------------------------------

const wss = new WsServer(parseInt(PORT, 10) + 1);

app.get('/connect', (req, res) => {
    const connection = {
        name: 'pablo'
    };
    const token = wss.invite(connection);
    // If no token was returned, this user is not authorized
    if (!token) {
        return res.status(401).end();
    }
    res.json({
        port: wss.port,
        token
    });
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
