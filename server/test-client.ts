import assert from 'node:assert';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import ms from 'ms';
import _ from 'lodash';

import { Debugger, makeDebug, makeToken } from './utility';
import config from './config';
import { IncomingMessages } from './incoming-messages';
import { OutgoingMessages } from './outgoing-messages';
import PromptPlayer from './prompt-player';
import { Bid, Trump, Bone } from './core';
import { stringify, parse } from './json';
import nextBotName from './bot-names';
import Tournament from './tournament';
import * as db from './tournament-db';
import TexasTime from './texas-time';
import { Rules } from './core';
import { TableUpdate, TournamentUpdate, UserUpdate } from './tournament-pusher';

const PORT = 4004;

const URL = `http://localhost:${PORT}`;

async function delay(m: number) {
    await new Promise((resolve) => setTimeout(resolve, m));
}

// let N = 1;

interface Options {
    noShow?: boolean;
    connectDelay?: number;
    noReply?: boolean;
    playDelay?: number;
}

class Client {

    private name: string;
    private tid: number;
    private debug: Debugger;
    private headers: Record<string, string>;
    private ws?: WebSocket;
    private tourney?: TournamentUpdate;
    private options: Options;

    constructor(tid: number, options: Options) {
        this.tid = tid;
        this.options = options;
        this.name = nextBotName();
        this.debug = makeDebug(this.name);
        this.debug.enabled = true;
        this.headers = {
            ['x-ft2-bot']: this.name
        }
        this.debug('%j', options);
    }

    private json(url: string) {
        return fetch(`${URL}${url}`, {
            headers: this.headers
        }).then((response) => response.json())
    }

    async connect() {
        await this.json('/api/tournaments/me');
        const ws = new WebSocket(`ws://localhost:${PORT}/api/tournaments/tws`, {
            headers: this.headers
        });
        ws.once('open', () => {
            this.ws = ws;
            this.ws.on('message', (data) => {
                const { type , message } = JSON.parse(data.toString());
                // this.debug('%s %j', type, message);
                switch (type) {
                     case 'tournaments':
                        this.tourney = (message as TournamentUpdate[])
                            .find(({id}) => id === this.tid);
                        break
                    case 'tournament':
                        if (message.id === this.tid) {
                            this.tourney = message;
                        }
                        break;
                    case 'user':
                        if (message.id === this.tid) {
                            this.signup(message as UserUpdate);
                        }
                        break;
                    case 'table':
                        this.join(message as TableUpdate);
                        break;
                }
            });
        });
    }

    signup(status: UserUpdate) {
        if (!this.tourney) {
            return;
        }
        if (this.tourney.open && !status.signedUp) {
            this.json(`/api/tournaments/signup/${this.tid}/null`)
        }
        if (status.winners) {
            if (status.winners?.includes(this.name)) {
                this.debug('winners', status.winners);
            }
            if (this.ws) {
                this.ws.close();
                this.ws = undefined;
            }
        }
    }

    async join(t: TableUpdate) {
        if (t.status === 't' && t.tid === this.tid) {
            if (this.options.noShow) {
                return;
            }
            const response = await fetch(`${URL}/play/${t.token}`, {
                headers: this.headers,
                redirect: 'manual'
            });
            assert(response.status === 302);
            if (this.options.connectDelay) {
                await delay(this.options.connectDelay);
            }
            const cookie = response.headers.get('set-cookie');
            assert(cookie);
            const ws = new WebSocket(`ws://localhost:${PORT}/ws`, {
                headers: {cookie}
            });
            const send = async (type: string, message: any, ack?: number) => {
                ws.send(JSON.stringify({ack, type, message}));
            }
            ws.once('open', () => {
                this.debug('connected');
                if (this.options.noReply) {
                    return;
                }
                ws.on('message', async (data) => {
                    const { ack, type, message } = JSON.parse(data.toString());
                    if (ack && this.options.playDelay) {
                        await delay(this.options.playDelay);
                    }
                    switch (type) {
                        case 'startingHand':
                            return send('readyToStartHand', null, ack);
                        case 'bid':
                            return send('submitBid', {bid: message.possible[0]}, ack);
                        case 'call':
                            return send('callTrump', {trump: message.possible[0]}, ack);
                        case 'play':
                            return send('playBone', {bone: message.possible[0]}, ack);
                        case 'endOfTrick':
                        case 'endOfHand':
                            return send('readyToContinue', null, ack);
                        case 'gameOver':
                            this.debug('game over');
                            break;
                    }
                });
                ws.once('close', () => {
                    this.debug('out');
                });
            });
        }
    }
}

(async () => {
    db.run('DELETE FROM tournaments');

    const open = TexasTime.today();
    const now = open.date.getTime();
    const close = new TexasTime(new Date(now + ms('5s')));
    const start = new TexasTime(new Date(now + ms('6s')));

    const t = new Tournament({
        id: 0,
        name: `Today's test tournament`,
        type: 1,
        signup_start_dt: open.toString(true),
        signup_end_dt: close.toString(true),
        start_dt: start.toString(true),
        rules: JSON.stringify(new Rules()),
        partner: 2,
        seed: 0,
        timezone: 'CST',
        signup_opened: 0,
        signup_closed: 0,
        started: 0,
        scheduled: 0,
        finished: 0,
        ladder_id: 0,
        ladder_name: '',
        lmdtm: '',
        invitation: 0,
        recurring: 0,
        invitees: '',
        prize: '',
        winners: '',
        recurring_source: 0,
        host: ''
    });
    t.saveWith({});

    await fetch(`${URL}/api/tournaments/td/reload`, {
        headers: { ['x-ft2-bot']: 'pablo' }
    });

    for (let i = 0; i < 8; ++i) {
        const options: Options = {
            // connectDelay: _.random(1000, 10000),
            // playDelay: _.random(100, 1000),
            noShow: true
            // noReply: _.random(0, 100) < 5,
        };
        new Client(t.id, options).connect();
        await delay(50);
    }
})()




// (async () => {
//     if (!name) {
//         const create = await fetch(`http://localhost:${PORT}/api/test-game/pablo`, {
//             redirect: 'manual'
//         });
//         debug(create.ok, create.status, create.statusText);
//         if (!create.ok && create.status !== 302) {
//             return;
//         }
//         name = 'pablo';
//     }
//     const response = await fetch(`http://localhost:${PORT}/api/join/${name}`, {
//         redirect: 'manual'
//     })
//     debug(response.status, response.statusText);
//     if (!response.ok && response.status !== 302) {
//         return;
//     }
//     const { headers } = response;
//     debug(JSON.stringify(headers));
//     const cookie = headers.get('set-cookie');
//     if (!cookie) {
//         debug('no set-cookie');
//         return;
//     }
//     const client = new WebSocket(`ws://localhost:${PORT}/ws`, {
//         headers: {cookie}
//     });

//     function send<K extends keyof IncomingMessages>(
//         type: K,
//         message: IncomingMessages[K],
//         ack?: number)
//     {
//         client.send(stringify({ack, type, message}));
//     }

//     const promptPlayer = new PromptPlayer();

//     client.on('open', () => {
//         debug('open');
//         /*
//         client.on('ping', (data) => debug('ping', data.toString()));
//         client.on('pong', (data) => debug('pong', data.toString()));
//         setInterval(() => {
//             const data = `c:${makeToken(4, 'hex')}`;
//             client.send(JSON.stringify({ping: data}));
//             client.ping(data);
//         }, ms('8s'));
//         */
//         client.on('message', (data) => {
//             debug('<-', data.toString());
//             const { ack, type, message }
//             : { ack?: number, type: keyof OutgoingMessages, message: any}
//                 = parse(data.toString());

//             if (type === 'startingHand') {
//                 return send('readyToStartHand', null, ack);
//             }
//             if (type === 'bid') {
//                 return promptPlayer.bid(message).then((bid) => {
//                     send('submitBid', {bid}, ack);
//                 });
//             }
//             if (type === 'call') {
//                 return promptPlayer.call(message).then((trump) => {
//                     send('callTrump', {trump}, ack);
//                 });
//             }
//             if (type === 'play') {
//                 return promptPlayer.play(message).then((bone) => {
//                     send('playBone', {bone}, ack);
//                 });
//             }
//             if (type === 'endOfTrick') {
//                 return send('readyToContinue', null, ack);
//             }
//             if (type === 'endOfHand') {
//                 return send('readyToContinue', null, ack);
//             }
//         });
//     });
//     client.on('close', () => debug('close'));
//     client.on('error', (error) => debug('error', error));
// })();
