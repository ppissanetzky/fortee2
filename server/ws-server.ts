import type { Request } from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { makeDebug } from './utility';
import User from './user';

//------------------------------------------------------------------------------

const debug = makeDebug('wss');

export default class WsServer {

    private readonly wss: WebSocketServer;
    private readonly connected = new Set<string>();

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
            const { user } = req;
            if (!user) {
                throw new Error('missing user');
            }
            const { id, name } = user;
            if (!(name && id)) {
                throw new Error('missing session name and userId');
            }
            if (this.connected.has(id)) {
                throw new Error(`user ${id} already connected`);
            }
            // Upgrade to a ws
            const ws = await new Promise<WebSocket>((resolve) => {
                const head = Buffer.alloc(0);
                this.wss.handleUpgrade(req, req.socket, head, resolve);
            });
            // Check again now, just in case
            if (this.connected.has(id)) {
                throw new Error(`user ${id} already connected`);
            }
            // All good
            debug('accepted', id);
            this.connected.add(id);
            // Create a user for it
            User.connected(name, ws)
                .gone.then(() => this.connected.delete(id));
        }
        catch (error) {
            debug(error instanceof Error ? error.message : error);
            req.socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            req.socket.destroy();
        }
    }
}
