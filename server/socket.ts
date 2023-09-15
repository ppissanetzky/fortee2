import assert from 'node:assert';
import _ from 'lodash';
import { WebSocket } from 'ws';

import { makeDebug } from './utility';
import { OutgoingMessages } from './outgoing-messages';
import type { IncomingMessages } from './incoming-messages';
import Dispatcher from './dispatcher';
import { stringify, parse } from './json';
import GameRoom from './game-room';
import { NextFunction, Request, Response } from 'express';
import WsServer from './ws-server';
import ms from 'ms';
import User from './users';
import config from './config';

interface Sent<T extends keyof OutgoingMessages, R extends keyof IncomingMessages> {
    readonly mid: number;
    readonly type: T;
    readonly message: OutgoingMessages[T];
    readonly reply?: R;
    readonly resolve: (value?: IncomingMessages[R]) => void;
}

const enum SocketType {
    PLAYER = 1,
    WATCHER = 2
}

/**
 * This is a connected WebSocket with a user name. It emits all the
 * incoming messages from this user and can send all the outgoing messages.
 */

export default class Socket extends Dispatcher<IncomingMessages> {

    static isConnected(userId: string): boolean {
        return this.connected.has(userId);
    }

    private static ID = 1;

    private static connected = new Map<string, Socket>();

    static upgrade(watching: boolean) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const { user, params: { token } } = req;
            if (!user) {
                return res.sendStatus(401);
            }

            const id = String(Socket.ID++);

            const debug = makeDebug('socket').extend(id).extend(user.name);

            const gameRoomToken = token;
            if (!gameRoomToken) {
                debug('missing grt');
                return res.sendStatus(400);
            }

            if (!GameRoom.rooms.has(gameRoomToken)) {
                debug('invalid room', gameRoomToken);
                return res.sendStatus(404);
            }

            if (!watching) {
                const existing = this.connected.get(user.id);
                if (existing) {
                    debug(`user %j already connected : disconnecting old connection`, user);
                    existing.close('new-connection');
                    const reason = await existing.gone;
                    debug(`closed %j with %s`, user, reason);
                }
            }

            try {
                const [ws] = await WsServer.get().upgrade(req);
                /** Create a socket for it */
                const type = watching ? SocketType.WATCHER : SocketType.PLAYER;
                const socket = new Socket(id, type, user, ws, gameRoomToken);
                if (!watching) {
                    this.connected.set(user.id, socket);
                    socket.gone.then(() => this.connected.delete(user.id));
                }
            }
            catch (error) {
                next(error);
            }
        }
    }

    public readonly type: SocketType;
    public readonly user: User;

    /**
     * A promise that is resolved when the ws is disconnected. It resolves
     * with the close reason.
     */

    public readonly gone: Promise<string>;

    /**
     * The next ack ID
     */

    private ACK = 2000;

    /**
     * An array of messages that either have not been sent, failed to send or
     * are waiting for a reply.
     */

    public readonly outstanding: any[] = [];

    private readonly debug = makeDebug('socket');
    private readonly ws: WebSocket;

    get isOpen(): boolean {
        return this.ws.readyState === this.ws.OPEN;
    }

    get isWatcher(): boolean {
        return this.type === SocketType.WATCHER;
    }

    get userId(): string {
        return this.user.id;
    }

    get name(): string {
        return this.user.name;
    }

    private constructor(id: string, type: SocketType, user: User, ws: WebSocket, gameRoomToken: string) {
        super();
        this.type = type;
        this.user = user;
        this.debug = this.debug.extend(id);
        if (type === SocketType.WATCHER) {
            this.debug = this.debug.extend('watching');
        }
        this.debug = this.debug.extend(user.name);
        this.ws = ws;
        this.debug('created');
        this.gone = new Promise<string>((resolve) => {
            ws.once('close', (code, reason) => {
                this.debug('close', code, reason.toString(),
                    'outstanding', this.outstanding.map(({mid, type}) =>
                        ([mid, type])).join(','));
                resolve(reason.toString());
            });
        });

        const room = GameRoom.rooms.get(gameRoomToken);

        if (!room) {
            this.debug(`room ${gameRoomToken} not found`);
            this.close('bad-room');
            return;
        }

        if (type === SocketType.PLAYER && room.names.has(user.name)) {
            this.debug(`already in room ${room.id}`);
            this.close('new-connection');
            return;
        }

        ws.on('error', (error) => this.debug('error', error));

        ws.on('message', (data) => {
            try {
                const s = data.toString();
                this.debug('<-', s);
                const { ack, type, message }
                    : { ack?: number, type: keyof IncomingMessages, message: any }
                    = parse(s);
                if (ack) {
                    const outstanding = this.outstanding
                        .find(({mid}) => mid === ack);
                    if (outstanding) {
                        _.pull(this.outstanding, outstanding);
                        this.debug('ack', ack);
                        outstanding.resolve(message);
                    }
                    else {
                        this.debug('ack', ack, 'not outstanding');
                    }
                }
                if (type) {
                    this.emit(type, message);
                }
            }
            catch (error) {
                this.debug('message failed', error, data.toString());
            }
        });

        /** For watchers, we send the host as 'youAre', to keep the illusion */
        const youAre = this.isWatcher ? room.host : user.name;

        /** Send the welcome message */
        this.send('welcome', {youAre, you: user})
            .then(() => room.join(this));
    }

    send<T extends keyof OutgoingMessages, R extends keyof IncomingMessages>(
        type: T,
        message: OutgoingMessages[T],
        reply?: R
    ): Promise<IncomingMessages[R] | void> {
        /** Watchers don't reply */
        if (this.type === SocketType.WATCHER) {
            reply = undefined;
        }
        const timeout: NodeJS.Timer | undefined = reply
            ? setTimeout(() => this.replyDelayed(), ms(config.FT2_REPLY_TIMEOUT))
            : undefined;
        const result = new Promise<IncomingMessages[R] | void>((resolve) => {
            const mid = this.ACK++;
            const ack = reply ? mid : undefined;
            const outstanding: Sent<T, R> = {
                mid,
                type,
                message,
                reply,
                resolve,
                // reject
            };

            this.outstanding.push(outstanding);

            const payload = stringify({
                ack: reply ? mid : undefined,
                type,
                message: message || undefined
            });

            this.ws.send(payload, (error) => {
                if (error) {
                    this.debug('->', 'failed', error);
                    // Not rejecting the promise: we leave it alone
                    // for someone else to do it. It'll stay in the list
                    // of outstanding messages
                    return;
                }
                this.debug('-> %s %s %j', ack || '', type, message);
                // If there is no reply, we're not waiting for a response
                // and we just sent it, so we take it out of the array
                // and resolve the promise since it was sent
                if (!reply) {
                    _.pull(this.outstanding, outstanding);
                    resolve();
                }
            });
        });
        /** Once the reply comes back, we clear the timeout */
        result.then(() => clearTimeout(timeout));
        return result;
    }

    async replay(target: Socket): Promise<void> {
        const next = this.outstanding.shift();
        if (!next) {
            this.debug('replay done');
            return;
        }
        const { type, message, reply } = next;
        this.debug('replaying', type, message, reply);
        const response = await target.send(type, message, reply);
        next.resolve(response);
        return this.replay(target);
    }

    private replyDelayed() {
        if (this.isOpen) {
            this.debug('reply delayed');
            this.send('alive', null, 'readyToContinue');
        }
    }

    close(reason: string, code = 4000) {
        switch (this.ws.readyState) {
            case this.ws.OPEN:
            case this.ws.CONNECTING:
                this.ws.close(code, reason);
        }
    }
}
