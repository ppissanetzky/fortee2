import WebSocket from 'ws';
import fetch from 'node-fetch';
import { makeDebug } from './utility';

const debug = makeDebug('test-client');
debug.enabled = true;

const name = process.argv[2] || 'pablo';

fetch(`http://localhost:4004/connect/${name}`)
    .then(async (response) => {
        const {port, token} = await response.json();
        const client = new WebSocket(`ws://localhost:${port}`);

        function send(type: string, message: any) {
            client.send(JSON.stringify({type, message}));
        }

        // On open, send the token
        client.on('open', () => {
            debug('open');
            client.send(token);
            client.on('ping', () => debug('ping'));
            client.on('message', (data) => {
                debug('raw', data.toString());
                const { ack, type, message } = JSON.parse(data.toString());
                debug('message', ack, type, message);
                if (ack) {
                    client.send(JSON.stringify({ack}));
                }
                if (type === 'welcome') {
                    send('createGame', {});
                }
            });
        });
        client.on('close', () => debug('close'));
        client.on('error', (error) => debug('error', error));
    });


