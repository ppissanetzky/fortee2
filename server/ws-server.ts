import type { Express, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import ms from 'ms';

import { makeDebug, makeToken } from './utility';
import Socket from './socket';
import config from './config';

//------------------------------------------------------------------------------

export default class WsServer {

    static create(app: Express) {
        new WsServer(app);
    }

    private readonly debug = makeDebug('wss');

    private readonly wss: WebSocketServer;

    /**
     * A set of all the connected user IDs - not names. So we can make
     * sure the same ID is only connected once.
     */

    private readonly connected = new Set<string>();

    private constructor(app: Express) {
        // From https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
        this.wss = new WebSocketServer({
            clientTracking: false,
            noServer: true
        });

        /**
         * This is where the WebSocket upgrade starts
         */

        app.get('/ws', (req, res) => this.upgrade(req, res));
    }

    private async upgrade(req: Request, res: Response) {

        /** Make sure it is an upgrade */

        const headers = ['connection', 'upgrade'].map((name) =>
            req.get(name)?.toLowerCase()).join();

        if (headers !== 'upgrade,websocket') {
            return res.sendStatus(400);
        }

        const user = req.user;

        if (!user) {
            return res.sendStatus(401);
        }

        const { id, name } = user;
        if (!(id && name)) {
            return res.sendStatus(401);
        }

        this.debug('upgrade', id, name);

        if (this.connected.has(id)) {
            this.debug(`user ${id} "${name}" already connected`);
            return res.sendStatus(403);
        }

        // Upgrade to a ws
        try {
            const ws = await new Promise<WebSocket>((resolve, reject) => {
                const head = Buffer.alloc(0);
                this.wss.on('wsClientError', reject);
                this.wss.handleUpgrade(req, req.socket, head, (ws) => {
                    this.wss.off('wsClientError', reject);
                    resolve(ws);
                });
            });

            // All good
            this.debug('accepted', id, name);
            this.setupPings(name, ws);
            this.connected.add(id);
            // Create a socket for it
            Socket.connected(name, ws)
                .gone.then(() => this.connected.delete(id));
        }
        catch (error) {
            this.debug('upgrade failed :', error instanceof Error
                ? error.message : error);
            res.sendStatus(400);
        }
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
}
