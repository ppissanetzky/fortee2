import _ from 'lodash';
import ms from 'ms';
import PushServer from './push-server';
import { makeDebug } from './utility';
import config from './config';
import User from './users';

const debug = makeDebug('chatter');

export interface ChatMessage {
    id: number;
    t: number;
    name: string;
    from: string;
    to: string;
    dm: boolean;
    title?: string;
    text: string;
}

export interface Channel {
    id: string;
    name: string;
    desc: string;
    unread?: boolean;
}

export interface ChatHistory {
    /** The channel or user ID for private chat */
    channel: string;
    messages: ChatMessage[];
}

interface ChannelSpec extends Channel {
    filter?: (user: User) => boolean;
}

const LOBBY = '#lobby';

class Channels {

    private static specs: ChannelSpec[] = [
        {
            id: LOBBY,
            name: 'lobby',
            desc: 'The lobby is a place where everyone can chat',
            filter: undefined,
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

    public static listFor(user: User): Channel[] {
        return this.specs.filter((spec) => !spec.filter ||
            spec.filter(user)).map(({id, name, desc}) => ({id, name, desc}));
    }

    public static isChannel(to: string) {
        return to.startsWith('#');
    }

    public static find(id: string): ChannelSpec | undefined {
        return this.map.get(id);
    }

    private constructor() { void 0 }
}

let MESSAGE_ID = 1;

export default class Chatter {

    private ps: PushServer;

    private history: ChatMessage[] = [];

    private lastRead = new Map<string, number>();

    constructor (ps: PushServer) {
        this.ps = ps;

        /** To delete old messages */

        setTimeout(() => setInterval(
            () => this.purgeHistory(), Math.min(ms('1h'), ms(config.FT2_CHAT_HISTORY))),
            ms(config.FT2_CHAT_HISTORY));

        ps.on('connected', ({userId, ws}) => {

           /** Get info about this user */

            const user = User.get(userId);
            if (!user) {
                debug('no info for', userId);
                return;
            }

            /** Send them the list of channels they're allowed to see*/
            this.sendChannels(user);

            const { name, roles } = user;
            const title = roles.includes('td') ? 'TD' : undefined;

            /** Listen to their messages */

            ws.on('message', (raw) => {
                const data = raw.toString();
                debug('<-', name, data);
                try {
                    const { type, message } = JSON.parse(data);
                    switch (type) {
                        case 'chat': {
                            const { to, text } = message;
                            const from = userId;
                            if (from === to) {
                                return
                            }
                            const incoming: ChatMessage = {
                                id: MESSAGE_ID++,
                                t: Date.now(),
                                name,
                                from: userId,
                                to,
                                dm: !Channels.isChannel(to),
                                title,
                                text
                            }
                            this.chat(user, incoming);
                        }
                        break;

                        case 'history': {
                            const { to , last } = message;
                            this.pushHistory(userId, to, last);
                        }
                        break;
                    }
                }
                catch (error) {
                    debug('bad message from', userId, data, error);
                }
            });
        });
    }

    public systemMessage(text: string) {
        const message = {
            id: MESSAGE_ID++,
            t: Date.now(),
            from: LOBBY,
            to: LOBBY,
            dm: false,
            text: '',
            name: text
        };
        this.history.push(message);
        this.ps.pushToAll('chat', message);
    }

    private chat(sender: User, message: ChatMessage) {
        if (Channels.isChannel(message.to)) {
            const channel = Channels.find(message.to);
            /** Invalid channel */
            if (!channel) {
                return;
            }
            const { filter } = channel;
            /** The channel is unfiltered, so we send it to all */
            if (!filter) {
                this.history.push(message);
                this.ps.pushToAll('chat', message);
            }
            /** Or, the channel is filtered and this user is allowed to send */
            else if (filter(sender)) {
                /** Add it to history */
                this.history.push(message);
                /** Gather all the users that are allowed to receive the message */
                const userIds = this.ps.users.filter((user) => filter(user)).map(({id}) => id);
                const recipients = Array.from(new Set(userIds).values());
                /** Send it to all and add it to history */
                this.ps.pushToMany(recipients, 'chat', message);
            }
        }
        /** Otherwise, the message is to a single user */
        else if (this.ps.has(message.to)) {
            this.history.push(message);
            /** Send the same message to both */
            this.ps.pushToMany([message.to, message.from], 'chat', message);
        }
    }

    private purgeHistory() {
        if (this.history.length === 0) {
            return;
        }
        /** The first message to keep */
        const first = Date.now() - ms(config.FT2_CHAT_HISTORY);
        const index = this.history.findIndex(({t}) => t >= first);
        if (index > 0) {
            debug('purging', index, 'old messages, have', this.history.length);
            this.history.splice(0, index);
        }
    }

    private pushHistory(userId: string, channel: string, last: number): void {
        let messages: ChatMessage[] = [];
        if (Channels.isChannel(channel)) {
            messages = this.history.filter(({to, id}) => to === channel && id > last);
            const unread = messages.at(-1)?.id;
            if (unread) {
                this.lastRead.set(`${userId}/${channel}`, unread);
            }
        }
        else {
            messages = this.history.filter(({from , to, id}) =>
                id > last && (from === channel && to === userId ||
                from === userId && to === channel));
        }
        this.ps.pushToOne(userId, 'history', {
            channel,
            messages
        });
    }

    private sendChannels(user: User) {
        const channels = Channels.listFor(user);
        const remaining = new Set(channels.map(({id}) => id));
        const unread = new Set<string>();
        for (let i = this.history.length - 1; i > 0 && remaining.size > 0; i--) {
            const { id, to } = this.history[i];
            if (remaining.delete(to)) {
                const last = this.lastRead.get(`${user.id}/${to}`) ?? 0;
                if (id > last) {
                    unread.add(to);
                }
            }
        }
        channels.forEach((channel) => {
            channel.unread = unread.has(channel.id);
        });
        this.ps.pushToOne(user.id, 'channels', channels);
    }
}
