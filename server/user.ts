import { WebSocket } from 'ws';

import { makeDebug } from './utility';
import { OutgoingMessages } from './outgoing-messages';
import type { IncomingMessages } from './incoming-messages';
import Dispatcher from './dispatcher';
import UserHandler from './user-handler';

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
     * The next message ID
     */

    private MID = 2000;

    /**
     * A set of message IDs that have not been acked yet
     */

    private sent = new Set<number>();

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
                    = JSON.parse(s);
                if (ack && this.sent.delete(ack)) {
                    this.debug('ack', ack);
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

    send<T extends keyof OutgoingMessages>(type: T, message: OutgoingMessages[T]) {
        const ack = undefined; // this.MID++;
        // this.sent.add(ack);
        this.ws.send(JSON.stringify({
            ack,
            type,
            message: message || undefined
        }), (error) => {
            if (error) {
                this.debug('->', 'failed', error);
            } else {
                this.debug('->', ack || '', type, message);
            }
        });
    }
}
