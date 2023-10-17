import ms from 'ms';
import PushServer from './push-server';
import { makeDebug } from './utility';
import config from './config';
import User from './users';

const debug = makeDebug('chatter');

export interface Message {
    t: number;
    name: string;
    title?: string;
    text: string;
    to?: string;
}

export default class Chatter {

    private ps: PushServer;

    private history: Message[] = [];

    constructor (ps: PushServer) {
        this.ps = ps;

        /** To delete old messages */

        const m = ms(config.FT2_CHAT_HISTORY);

        setTimeout(() => setInterval(() => this.purgeHistory(), m), m);

        ps.on('connected', ({userId, ws}) => {

            /** Send them the message history right away */

            this.ps.pushToOne(userId, 'chatHistory', this.history);

            /** Get info about this user */

            const info = User.get(userId);
            if (!info) {
                debug('no info for', userId);
                return;
            }
            const { name, roles } = info;
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
                            this.chat(userId, info.name, title, text as string, to);
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
        this.chat('', text, undefined, '');
    }

    private chat(from: string, name: string, title: string | undefined, text: string, to?: string) {
        const message : Message = {
            t: Date.now(),
            name,
            title,
            text
        };
        if (!to) {
            this.history.push(message);
            this.ps.pushToAll('chat', message);
        } else {
            this.ps.pushToOne(to, 'chat', {
                ...message,
                to: from,
            });
            this.ps.pushToOne(from, 'chat', {
                ...message,
                to
            });
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
            /** Update everyone */
            this.ps.pushToAll('chatHistory', this.history);
        }
        else {
            debug('nothing to purge');
        }
    }
}
