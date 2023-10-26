import _ from 'lodash';
import ms from 'ms';
import PushServer from './push-server';
import { makeDebug } from './utility';
import config from './config';
import User from './users';

const debug = makeDebug('chatter');

export interface ChatMessage {
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

export default class Chatter {

    private ps: PushServer;

    private history: ChatMessage[] = [];

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
            this.ps.pushToOne(userId, 'channels', Channels.listFor(user));

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

                        case 'history':
                            if (_.isString(message)) {
                                this.ps.pushToOne(userId, 'chatHistory',
                                    this.historyFor(message, userId));
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

    private historyFor(channel: string, userId: string): ChatHistory {
        let messages: ChatMessage[] = [];
        if (Channels.isChannel(channel)) {
            messages = this.history.filter(({to}) => to === channel);
        }
        else {
            messages = this.history.filter(({from , to}) =>
                from === channel && to === userId ||
                from === userId && to === channel);
        }
        return {
            channel,
            messages
        };
    }
}
