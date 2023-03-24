import type { Request } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import ms from 'ms';

import { makeDebug, makeToken } from './utility';
import Socket from './socket';
import config from './config';

//------------------------------------------------------------------------------

export default class WsServer {

    private readonly debug = makeDebug('wss');

    private readonly wss: WebSocketServer;

    /**
     * A set of all the connected user IDs - not names. So we can make
     * sure the same ID is only connected once.
     */

    private readonly connected = new Set<string>();

    constructor() {
        // From https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
        this.wss = new WebSocketServer({
            clientTracking: false,
            noServer: true
        });
    }

    private setupPings(name: string, ws: WebSocket) {
        const debug = this.debug.extend(name);
        const interval = setInterval(() => {
            const data = `s:${makeToken(4, 'hex')}`;
            debug('-> ping', data);
            ws.ping(data);
        }, ms(config.FT2_PING_INTERVAL));
        ws.once('close', () => {
            clearInterval(interval);
        });
        ws.on('pong', (data) => {
            debug('<- pong', data.toString());
        });
        ws.on('ping', (data) => {
            debug('<- ping', data.toString());
        });
        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.ping) {
                debug('<- ping message', message.ping);
                ws.send(JSON.stringify({
                    pong: message.ping
                }));
            }
        });
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
            this.debug('upgrade', id, name);
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
            this.debug('accepted', id, name);
            this.setupPings(name, ws);
            this.connected.add(id);
            // Create a socket for it
            Socket.connected(name, ws)
                .gone.then(() => this.connected.delete(id));
        }
        catch (error) {
            this.debug(error instanceof Error ? error.message : error);
            req.socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            req.socket.destroy();
        }
    }
}
