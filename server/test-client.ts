import WebSocket from 'ws';
import fetch from 'node-fetch';
import ms from 'ms';

import { makeDebug, makeToken } from './utility';
import config from './config';
import { IncomingMessages } from './incoming-messages';
import { OutgoingMessages } from './outgoing-messages';
import PromptPlayer from './prompt-player';
import { Bid, Trump, Bone } from './core';
import { stringify, parse } from './json';

const debug = makeDebug('test-client');
debug.enabled = true;

const PORT = 4004;

let name = process.argv[2];

(async () => {
    if (!name) {
        const create = await fetch(`http://localhost:${PORT}/api/test-game/pablo`, {
            redirect: 'manual'
        });
        debug(create.ok, create.status, create.statusText);
        if (!create.ok && create.status !== 302) {
            return;
        }
        name = 'pablo';
    }
    const response = await fetch(`http://localhost:${PORT}/api/join/${name}`, {
        redirect: 'manual'
    })
    debug(response.status, response.statusText);
    if (!response.ok && response.status !== 302) {
        return;
    }
    const { headers } = response;
    debug(JSON.stringify(headers));
    const cookie = headers.get('set-cookie');
    if (!cookie) {
        debug('no set-cookie');
        return;
    }
    const client = new WebSocket(`ws://localhost:${PORT}/ws`, {
        headers: {cookie}
    });

    function send<K extends keyof IncomingMessages>(
        type: K,
        message: IncomingMessages[K],
        ack?: number)
    {
        client.send(stringify({ack, type, message}));
    }

    const promptPlayer = new PromptPlayer();

    client.on('open', () => {
        debug('open');
        /*
        client.on('ping', (data) => debug('ping', data.toString()));
        client.on('pong', (data) => debug('pong', data.toString()));
        setInterval(() => {
            const data = `c:${makeToken(4, 'hex')}`;
            client.send(JSON.stringify({ping: data}));
            client.ping(data);
        }, ms('8s'));
        */
        client.on('message', (data) => {
            debug('<-', data.toString());
            const { ack, type, message }
            : { ack?: number, type: keyof OutgoingMessages, message: any}
                = parse(data.toString());

            if (type === 'startingHand') {
                return send('readyToStartHand', null, ack);
            }
            if (type === 'bid') {
                return promptPlayer.bid(message).then((bid) => {
                    send('submitBid', {bid}, ack);
                });
            }
            if (type === 'call') {
                return promptPlayer.call(message).then((trump) => {
                    send('callTrump', {trump}, ack);
                });
            }
            if (type === 'play') {
                return promptPlayer.play(message).then((bone) => {
                    send('playBone', {bone}, ack);
                });
            }
            if (type === 'endOfTrick') {
                return send('readyToContinue', null, ack);
            }
            if (type === 'endOfHand') {
                return send('readyToContinue', null, ack);
            }
        });
    });
    client.on('close', () => debug('close'));
    client.on('error', (error) => debug('error', error));
})();
