import type { Request } from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { makeDebug } from './utility';
import User from './user';

//------------------------------------------------------------------------------

const debug = makeDebug('wss');

export default class WsServer {

    private readonly wss: WebSocketServer;
    private readonly connected = new Map<string, WebSocket>();

    constructor() {
        // From https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
        this.wss = new WebSocketServer({
            clientTracking: false,
            noServer: true
        });
        // setInterval(() => {
        //     const message = JSON.stringify({
        //         ping: new Date().toString()
        //     });
        //     this.wss.clients.forEach((ws) => {
        //         debug('ping');
        //         ws.send(message);
        //         ws.ping();
        //     });
        // }, ms('30m'));

        debug('started');
    }

    async upgrade(req: Request) {
        try {
            const { session: { name, userId } } = req;
            if (!(name && userId)) {
                throw new Error('missing session name and userId');
            }
            const key = `${name}:${userId}`;
            if (this.connected.has(key)) {
                throw new Error(`user ${key} already connected`);
            }
            // Upgrade to a ws
            const ws = await new Promise<WebSocket>((resolve) => {
                const head = Buffer.alloc(0);
                this.wss.handleUpgrade(req, req.socket, head, resolve);
            });
            // Check again now, just in case
            if (this.connected.has(key)) {
                throw new Error(`user ${key} already connected`);
            }
            // All good
            debug('accepted', key);
            this.connected.set(key, ws);
            // Create a user for it
            User.connected(name, ws)
                .gone.then(() => this.connected.delete(key));
        }
        catch (error) {
            debug(error instanceof Error ? error.message : error);
            req.socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            req.socket.destroy();
        }
    }
}
