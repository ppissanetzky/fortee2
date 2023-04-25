import type { Request } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import ms from 'ms';

import { makeDebug } from './utility';
import config from './config';

/**
 * This is an exception that Express treats as an HTTP error because it has
 * a 'status' property
 */

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

    static get(): WsServer {
        if (!this.instance) {
            this.instance = new WsServer();
        }
        return this.instance;
    }

    private static instance?: WsServer;

    private readonly debug = makeDebug('wss');

    private readonly wss: WebSocketServer;

    private constructor() {
        // From https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
        this.wss = new WebSocketServer({
            clientTracking: false,
            noServer: true
        });
    }

    public async upgrade(req: Request): Promise<[WebSocket, Express.User]> {
        const { user } = req;
        if (!user) {
            throw status(401);
        }
        const { id, name } = user;
        if (!(id && name)) {
            throw status(401);
        }
        /** A bug in WS, if the header is not present, it throws a type error */
        if (!req.headers.upgrade) {
            throw status(400);
        }
        /** Upgrade */
        try {
            const ws = await new Promise<WebSocket>((resolve, reject) => {
                const { socket } = req;
                const head = Buffer.alloc(0);
                /**
                 * If the upgrade fails for some reason, the callback is never
                 * invoked and, instead, the server closes the socket. This is
                 * the only indication
                 */
                const finish = () => reject(new Error('Upgrade failed'));
                socket.on('finish', () => finish);

                this.wss.handleUpgrade(req, socket, head, (ws) => {
                    socket.off('finish', finish);
                    resolve(ws);
                });
            });
            // All good
            this.debug('accepted %j', user);
            this.setupPings(user.name, ws);
            return [ws, user];
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
            const data = `s:${new Date().toISOString()}`;
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
        ws.on('error', (error) => {
            debug('error', error);
        });
    }
}
