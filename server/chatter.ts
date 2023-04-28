import ms from 'ms';
import PushServer from './push-server';
import { getUser } from './tournament-db';
import { makeDebug } from './utility';
import config from './config';

const debug = makeDebug('chatter');

export interface Message {
    t: number;
    name: string;
    title?: string;
    text: string;
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

            const info = getUser(userId);
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
                        case 'chat':
                            this.chat(info.name, title, message as string);
                            break;
                    }
                }
                catch (error) {
                    debug('bad message from', userId, data, error);
                }
            });
        });
    }

    private chat(name: string, title: string | undefined, text: string) {
        const message = {
            t: Date.now(),
            name,
            title,
            text
        };
        this.history.push(message);
        this.ps.pushToAll('chat', message);
    }

    private purgeHistory() {
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
