import { WebSocket } from 'ws';

import { makeDebug } from './utility';
import { OutgoingMessages } from './outgoing-messages';
import type { IncomingMessages } from './incoming-messages';
import Dispatcher from './dispatcher';
import UserHandler from './user-handler';
import { stringify, parse } from './json';

export default class User extends Dispatcher<IncomingMessages> {

    static connected(name: string, ws: WebSocket): User {
        return new User(name, ws);
    }

    public readonly name: string;

    /**
     * A promise that is resolved when the user is gone
     */

    public readonly gone: Promise<string>;

    /**
     * The next ack ID
     */

    private ACK = 2000;

    /**
     * A map of message IDs that were sent and are waiting for an ack.
     */

    private readonly outstanding = new Map<number, CallableFunction>();

    private readonly debug = makeDebug('user');
    private readonly ws: WebSocket;

    private readonly handler: UserHandler;

    private constructor(name: string, ws: WebSocket) {
        super();
        this.name = name;
        this.debug = this.debug.extend(name);
        this.ws = ws;
        this.debug('created');
        this.gone = new Promise((resolve) => {
            ws.once('close', (code, reason) => {
                this.debug('close', code, reason.toString());
                resolve(name);
            })
        });
        this.handler = new UserHandler(this);

        ws.on('pong', () => this.debug('pong'));
        ws.on('error', (error) => this.debug('error', error));

        ws.on('message', (data) => {
            try {
                const s = data.toString();
                this.debug('<-', s);
                const { ack, type, message }
                    : { ack?: number, type: keyof IncomingMessages, message: any }
                    = parse(s);
                if (ack) {
                    const resolve = this.outstanding.get(ack);
                    if (resolve) {
                        this.outstanding.delete(ack);
                        this.debug('ack', ack);
                        resolve(message);
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

        // Send the welcome message
        this.send('welcome', null);
    }

    send<T extends keyof OutgoingMessages, R extends keyof IncomingMessages>(
        type: T,
        message: OutgoingMessages[T],
        reply?: R
    ): Promise<IncomingMessages[R] | void> {
        return new Promise((resolve, reject) => {
            const ack = reply ? this.ACK++ : undefined;
            if (ack) {
                this.outstanding.set(ack, resolve);
            }
            this.ws.send(stringify({
                ack,
                type,
                message: message || undefined
            }), (error) => {
                if (error) {
                    this.debug('->', 'failed', error);
                    return reject(error);
                }
                this.debug('->', ack || '', type, message);
                if (!ack) {
                    resolve();
                }
            });
        });
    }
}
