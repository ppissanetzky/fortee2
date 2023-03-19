
import fs from 'fs';

import express from 'express';
import ms from 'ms';

import { WebSocket, WebSocketServer } from 'ws';

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
    console.log(req.method, req.url, req.get('content-length') || '');
    next();
});

//-----------------------------------------------------------------------------

if (fs.existsSync('./site')) {
    app.use(express.static('./site'));
}
else {
    console.warn('Not serving static site');
}

//-----------------------------------------------------------------------------
// The port that the Express application listens to.
//-----------------------------------------------------------------------------

const PORT = process.env.FB_PORT || '4004';

//-----------------------------------------------------------------------------
// Start listening
//-----------------------------------------------------------------------------

const server = app.listen(PORT, async () => {
    console.log(`FortyTwo ready at http://localhost:${PORT}`);
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

//-----------------------------------------------------------------------------
// Web socket server
//-----------------------------------------------------------------------------

const wss = new WebSocketServer({
    port: parseInt(PORT, 10) + 1
});

wss.on('connection', (ws: WebSocket) => {
    console.log('WS connect');
    ws.on('pong', () => {
        console.log('WS pong');
    });
    ws.on('message', (data) => {
        console.log(`WS message : "${data}"`);
    });
});

setInterval(() => {
    const message = JSON.stringify({
        ping: new Date().toString()
    });
    wss.clients.forEach((ws) => {
        console.log(`WS ping`);
        ws.send(message);
        ws.ping();
    });
}, ms('30m'));


//-----------------------------------------------------------------------------
// Control messages that are broadcast to all the WS clients
//-----------------------------------------------------------------------------

// app.post('/control', (req, res) => {
//     const {body} = req;
//     console.log('WS control', body.type);
//     const data = JSON.stringify(body);
//     wss.clients.forEach((ws) => {
//         ws.send(data);
//     });
//     res.status(200).end();
// });

//-----------------------------------------------------------------------------

