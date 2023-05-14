import type { Request } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import ms from 'ms';

import { formatDuration, makeDebug } from './utility';
import config from './config';
import User from './users';
import ServerStatus from './server-status';

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

export interface SocketStats {
    name: string;
    url: string;
    /** The time the socket connected */
    connected: number;
    /** The time we got the last ping message */
    lastPingMessage: number;
    /** The time we sent the last ping frame */
    lastPingOut: number;
    /** The time we received the last pong frame */
    lastPong: number;
    /** Difference between last pong and last ping */
    latency: number;
    /** The time we received the last ping frame from the client */
    lastPing: number;
    /** The time we received the last message */
    lastMessage: number;
    /** The time we got the last error */
    lastError: number;
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

    public readonly stats = new Map<WebSocket, SocketStats>();

    private constructor() {
        // From https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
        this.wss = new WebSocketServer({
            clientTracking: false,
            noServer: true
        });
        this.publishStatus();
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
                 * invoked and, instead, the server closes the socket.
                 * The 'finish' event is the only indication. If it succeeds,
                 * the callback is invoked, so we remove the 'finish' listener
                 */

                socket.once('finish', reject);

                this.wss.handleUpgrade(req, socket, head, (ws) => {
                    socket.off('finish', reject);
                    resolve(ws);
                });
            });
            // All good
            this.debug('accepted %j', user);
            this.setupPings(req, user, ws);
            return [ws, user];
        }
        catch (error) {
            this.debug('upgrade failed :', error instanceof Error
                ? error.message : error);
            throw status(500);
        }
    }

    private setupPings(req: Request, user: User, ws: WebSocket) {
        const stats: SocketStats = {
            url: req.url,
            name: user.name,
            connected: Date.now(),
            lastPingMessage: 0,
            lastPingOut: 0,
            lastPong: 0,
            latency: 0,
            lastPing: 0,
            lastMessage: 0,
            lastError: 0
        };
        this.stats.set(ws, stats);
        const debug = this.debug.extend(user.name);
        const interval = setInterval(() => {
            const data = `s:${new Date().toISOString()}`;
            debug('-> ping', data);
            ws.ping(data);
            stats.lastPingOut = Date.now();
        }, ms(config.FT2_PING_INTERVAL));
        ws.on('pong', (data) => {
            debug('<- pong', data.toString());
            stats.lastPong = Date.now();
            stats.latency = stats.lastPong - stats.lastPingOut;
        });
        ws.on('ping', (data) => {
            debug('<- ping', data.toString());
            stats.lastPing = Date.now();
        });
        ws.on('message', (data) => {
            stats.lastMessage = Date.now();
            const message = JSON.parse(data.toString());
            if (message.ping) {
                stats.lastPingMessage = Date.now();
                debug('<- ping message', message.ping);
                ws.send(JSON.stringify({
                    pong: message.ping
                }));
            }
        });
        ws.on('error', (error) => {
            debug('error', error);
            stats.lastError = Date.now();
        });
        ws.once('close', () => {
            clearInterval(interval);
            this.stats.delete(ws);
        });
    }

    private publishStatus() {
        const columns = [
            'url',
            'name',
            'uptime',
            'lastPingMessage',
            'lastPingOut',
            'lastPong',
            'latency',
            'lastPing',
            'lastMessage',
            'lastError'
        ];
        ServerStatus.publish({
            name: 'WebSockets',
            get: () => {
                const now = Date.now();
                const convert = (n: number) =>
                    n ? formatDuration(now - n) : '';
                const rows = [];
                for (const s of this.stats.values()) {
                    rows.push([
                        s.url,
                        s.name,
                        convert(s.connected),
                        convert(s.lastPingMessage),
                        convert(s.lastPingOut),
                        convert(s.lastPong),
                        convert(s.latency),
                        convert(s.lastPing),
                        convert(s.lastMessage),
                        convert(s.lastError)
                    ]);
                }
                return { columns, rows };
            }
        });
    }
}
