import assert from 'node:assert';
import { EventEmitter } from 'node:stream';

import Tournament from './tournament';
import TournamentDriver from './tournament-driver';
import { makeDebug } from './utility';
import type Socket from './socket';
import Bot from './bot';
import { Rules } from './core';
import User from './users';

const debug = makeDebug('test-t');

const t = new Tournament({
    id: 1,
    name: ``,
    type: 1,
    signup_start_dt: '',
    signup_end_dt: '',
    start_dt: '',
    rules: JSON.stringify(new Rules()),
    partner: 1,
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
    host: 'bots'
});

function s(n: string): [string, null] {
    return [n, null];
}

const signups: string[] = [];

for (let i = 0; i < 1; i++) {
    signups.push(`P${i}`);
}

//t.signups = () => new Map(signups.map((n) => s(n)));

for (const id of signups) {
    User.login({
        id,
        name: id,
        displayName: id,
        ourName: null,
        notes: null,
        email: '',
        source: 'test',
        type: 'standard',
        roles: [],
        prefs: {}
    });
}

const driver = new TournamentDriver(t);

driver.on('announceBye', ({user}) => debug('bye', user));
driver.on('summonTable', ({room}) => {
    debug('summon %j', room.table.table);
    for (const p of room.table.table) {
        assert(p);
        if (p.id.startsWith(':bot:')) {
            continue;
        }
        const bot = new Bot(p.id, true) as any;
        const emitter = new EventEmitter();
        const socket = {
            name: p.id,
            gone: new Promise<void>(() => void 0),
            async send(type: any, message: any, reply: any) {
                const f = bot[type];
                if (f) {
                    const result = await f.call(bot, message);
                    switch (type) {
                        case 'bid':
                            return Promise.resolve({bid: result})
                        case 'call':
                            return Promise.resolve({trump: result})
                        case 'play':
                            return Promise.resolve({bone: result})
                    }
                    return Promise.resolve(result);
                }
            },
            on: emitter.on.bind(emitter),
            close: () => void 0,
        };
        room.join(socket as unknown as Socket);
    }
});

(async () => {
    await driver.run();
    console.log('done');
})();
