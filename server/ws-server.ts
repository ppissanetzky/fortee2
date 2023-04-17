import assert from 'node:assert';

import type { Express, Request } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import ms from 'ms';

import { expected, makeDebug, makeToken } from './utility';
import Socket from './socket';
import config from './config';

class StatusError extends Error {
    constructor(public readonly status: number) {
        super(String(status));
    }
}

function status(status: number) {
    return new StatusError(status);
}

//------------------------------------------------------------------------------

export default class WsServer {

    static create(app: Express) {
        assert(!this.instance);
        this.instance = new WsServer(app);
    }

    static get(): WsServer {
        const { instance } = this;
        assert(instance);
        return instance;
    }

    private static instance?: WsServer;

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

        app.get('/ws', async (req, res, next) => {
            const user = req.user;
            if (!user) {
                return next(status(401));
            }

            const { gameRoomToken } = req.session;
            if (!gameRoomToken) {
                this.debug('missing grt');
                return next(status(400));
            }

            this.debug('upgrade %j', user);
            if (this.connected.has(user.id)) {
                this.debug(`user %j already connected`, user);
                return next(status(403));
            }

            try {
                const ws = await this.upgrade(req);
                const user = expected(req.user);
                this.connected.add(user.id);
                // Create a socket for it
                Socket.connected(user.name, ws, expected(req.session.gameRoomToken))
                    .gone.then(() => this.connected.delete(user.id));
            }
            catch (error) {
                next(error);
            }
        });
    }

    public async upgrade(req: Request): Promise<WebSocket> {
        /** Make sure it is an upgrade */
        const headers = ['connection', 'upgrade'].map((name) =>
            req.get(name)?.toLowerCase()).join();
        if (headers !== 'upgrade,websocket') {
            throw status(400);
        }
        const { user } = req;
        if (!user) {
            throw status(401);
        }
        const { id, name } = user;
        if (!(id && name)) {
            throw status(401);
        }
        // Upgrade to a ws
        try {
            const ws = await new Promise<WebSocket>((resolve, reject) => {
                const head = Buffer.alloc(0);
                this.wss.once('wsClientError', reject);
                this.wss.handleUpgrade(req, req.socket, head, (ws) => {
                    this.wss.off('wsClientError', reject);
                    resolve(ws);
                });
            });
            // All good
            this.debug('accepted %j', user);
            this.setupPings(user.name, ws);
            return ws;
        }
        catch (error) {
            this.debug('upgrade failed :', error instanceof Error
                ? error.message : error);
            throw status(500);
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
