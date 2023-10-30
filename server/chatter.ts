import ms from 'ms';
import type { WebSocket } from 'ws';

import PushServer from './push-server';
import { makeDebug } from './utility';
import config from './config';
import User from './users';
import db from './chat-database';
import type {
    IncomigChatMessage,
    ChatMessage,
    ChatHistory,
    OutgoingChatMessage } from './chat-database';

const debug = makeDebug('chatter');

export type { ChatHistory, OutgoingChatMessage};

interface HistoryMessage {
    to: string;
    last?: number;
}

export interface Channel {
    id: string;
    name: string;
    desc: string;
}

export interface ChannelList {
    channels: Channel[];
    /** A set of channel IDs that are unread */
    unread: string[];
}

interface ChannelSpec extends Channel {
    filter: (user: User) => boolean;
}

const LOBBY = '#lobby';

class Channels {

    private static specs: ChannelSpec[] = [
        {
            id: LOBBY,
            name: 'lobby',
            desc: 'The lobby is a place where everyone can chat',
            filter: () => true,
        },
        {
            id: '#td-land',
            name: 'td-land',
            desc: 'A chat room for TDs only',
            filter: (user) => user.isTD
        }
    ];

    private static map: Map<string, ChannelSpec> =
        new Map(this.specs.map((spec) => [spec.id, spec]));

    public static isChannel(to: string) {
        return to.startsWith('#');
    }

    public static listFor(user: User): Channel[] {
        return this.specs.filter((spec) => !spec.filter ||
            spec.filter(user)).map(({id, name, desc}) => ({id, name, desc}));
    }

    public static find(id: string): ChannelSpec | undefined {
        return this.map.get(id);
    }

    private constructor() { void 0 }
}

interface Sub {
    channel: string;
    t: number;
}

class Connection {

    readonly ws: WebSocket;
    readonly user: User;

    sub?: Sub;

    constructor (ws: WebSocket, user: User) {
        this.ws = ws;
        this.user = user;
    }

    get id(): string {
        return this.user.id;
    }

    get name(): string {
        return this.user.name;
    }

    get title(): string | undefined {
        return this.user.roles.includes('td') ? 'TD' : undefined;
    }

    unsubscribe() {
        const { sub } = this;
        this.sub = undefined;
        if (sub) {
            db.read(this.id, sub.channel, sub.t );
        }
    }

    subscribe(channel: string, t: number) {
        this.unsubscribe();
        this.sub = {
            channel,
            t
        };
    }
}

export default class Chatter {

    private connections = new Map<WebSocket, Connection>;

    /** To introduce a gap in time between writes to the database */

    private queue: Promise<void> = Promise.resolve();

    constructor (ps: PushServer) {

        /** To delete old messages */

        setTimeout(() => setInterval(
            () => this.purgeHistory(), Math.min(ms('1h'), ms(config.FT2_CHAT_HISTORY))),
            ms(config.FT2_CHAT_HISTORY));

        type Task = (c: Connection) => void | Promise<void>;

        const enqueue = (ws: WebSocket, task: Task) => {
            this.enqueue(() => {
                const c = this.connections.get(ws);
                if (c) {
                    return task(c);
                }
            });
        }

        ps.on('connected', ({userId, ws}) => {

            /** Get info about this user */
            const user = User.get(userId);
            if (!user) {
                debug('no info for', userId);
                return;
            }

            /** Add them to the list */
            this.connections.set(ws, new Connection(ws, user));

            ws.once('close', () => {
                this.connections.delete(ws);
                enqueue(ws, (c) => c.unsubscribe());
            });

            /** Send them the list of channels they're allowed to see*/
            enqueue(ws, (c) => this.sendChannels(c));

            /** Listen to their messages */
            ws.on('message', (raw) => {
                const data = raw.toString();
                // debug('<-', user.name, data);
                try {
                    const { type, message } = JSON.parse(data);
                    switch (type) {
                        case 'chat':
                            enqueue(ws, (c) =>
                                this.chat(c, message as IncomigChatMessage));
                            break;

                        case 'history':
                            enqueue(ws, (c) =>
                                this.subscribe(c, message as HistoryMessage));
                            break;
                    }
                }
                catch (error) {
                    debug('bad message from', userId, data, error);
                }
            });
        });
        this.systemMessage('The server restarted');
    }

    private channelFor(from: string, to: string): ChannelSpec | undefined {
        if (Channels.isChannel(to)) {
            return Channels.find(to);
        }
        const us = [from, to].sort();
        return {
            id: us.join('/'),
            name: to,
            desc: '',
            filter: (user) => us.includes(user.id)
        }
    }

    public systemMessage(text: string, to = LOBBY) {
        const channel = Channels.find(to);
        if (!channel) {
            return;
        }
        this.enqueue(() => {
            const message: ChatMessage = {
                from: to,
                to,
                text: '',
                name: text
            };
            return this.send(channel, message);
        });
    }

    private enqueue(task: () => void | Promise<void>): void {
        this.queue = this.queue
            .then(task)
            .catch((error) => debug('task failed', error));
    }

    private chat(c: Connection, message: IncomigChatMessage) {
        const from = c.id;
        const { to } = message;
        /** Cannot message yourself */
        if (from === to) {
            return;
        }
        const channel = this.channelFor(from, to);
        if (!channel) {
            return;
        }
        /** This user is not allowed to send to this channel */
        if (!channel.filter(c.user)) {
            return;
        }
        return this.send(channel, {
            ...message,
            from,
            name: c.name,
            title: c.title
        });
    }

    private async send(channel: ChannelSpec, message: ChatMessage) {
        await new Promise((resolve) => setTimeout(resolve, 3));
        const outgoing = db.insert(channel.id, message);
        const chat = JSON.stringify({
            type: 'chat',
            message: outgoing
        });
        const unread = JSON.stringify({
            type: 'unread',
            message: channel.id
        });
        for (const [ws, target] of this.connections.entries()) {
            /** This user should get the message */
            if (channel.filter(target.user)) {
                /**
                 * This connection is subscribed to this channel, so
                 * we send them the message and set the last t
                 */
                if (target.sub?.channel === channel.id) {
                    ws.send(chat);
                    target.sub.t = outgoing.t;
                }
                /**
                 * The connection is not subscribed, so they should
                 * get an unread
                 */
                else {
                    ws.send(unread);
                }
            }
        }
    }

    private subscribe(c: Connection, message: HistoryMessage) {
        const channel = this.channelFor(c.id, message.to);
        /** The channel doesn't exist or the user is not allowed in it */
        if (!channel?.filter(c.user)) {
            return
        }
        const first = Date.now() - ms(config.FT2_CHAT_HISTORY);
        const after = Math.max(message.last ?? 0, first);
        const messages = db.history(channel.id, after);
        const t = messages.at(-1)?.t ?? after;
        /** Update the subscription */
        c.subscribe(channel.id, t);
        const history: ChatHistory = {
            channel: channel.id,
            messages
        };
        // debug(c.id, message.to, messages.length, messages.at(0)?.t, messages.at(-1)?.t);
        c.ws.send(JSON.stringify({
            type: 'history',
            message: history
        }));
    }

    private purgeHistory() {
        // if (this.history.length === 0) {
        //     return;
        // }
        // /** The first message to keep */
        // const first = Date.now() - ms(config.FT2_CHAT_HISTORY);
        // const index = this.history.findIndex(({t}) => t >= first);
        // if (index > 0) {
        //     debug('purging', index, 'old messages, have', this.history.length);
        //     this.history.splice(0, index);
        // }
    }

    private sendChannels(c: Connection) {
        const { user } = c;
        const channels = Channels.listFor(user);
        const allowed = new Set(channels.map(({id}) => id));
        /** Filter out channels this user doesn't have access to */
        const unread = db.unread(user.id).filter((channel) =>
            Channels.isChannel(channel)
                ? allowed.has(channel)
                : true);
        const message: ChannelList = {
            channels,
            unread,
        };
        //debug(user.id, message);
        c.ws.send(JSON.stringify({
            type: 'channels',
            message
        }));
    }
}
