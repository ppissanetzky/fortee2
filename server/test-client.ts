import WebSocket from 'ws';
import fetch from 'node-fetch';

import { makeDebug } from './utility';
import config from './config';
import { IncomingMessages } from './incoming-messages';
import { OutgoingMessages } from './outgoing-messages';
import PromptPlayer from './prompt-player';
import { Bid, Trump, Bone } from './core';
import { stringify, parse } from './json';

const debug = makeDebug('test-client');
debug.enabled = true;

const PORT = 4004;

const name = process.argv[2] || 'pablo';

fetch(`http://localhost:${PORT}/local-login`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
        username: name,
        password: config.FT2_LOCAL_PASSWORD
    })
})
    .then(async (response) => {
        debug(response.status, response.statusText);
        if (!response.ok) {
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

        // On open, send the token
        client.on('open', () => {
            debug('open');
            client.on('ping', () => debug('ping'));
            client.on('message', (data) => {
                debug('<-', data.toString());
                const { ack, type, message }
                : { ack?: number, type: keyof OutgoingMessages, message: any}
                    = parse(data.toString());
                if (type === 'welcome') {
                    return send('createGame', {});
                }
                if (type === 'youEnteredGameRoom') {
                    return send('inviteBot', {fillRoom: true});
                }
                if (type === 'gameRoomFull') {
                    return send('startGame', null)
                }
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
            });
        });
        client.on('close', () => debug('close'));
        client.on('error', (error) => debug('error', error));
    });


