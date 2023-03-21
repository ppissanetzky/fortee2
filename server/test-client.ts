import WebSocket from 'ws';
import fetch from 'node-fetch';
import { makeDebug } from './utility';

const debug = makeDebug('test-client');
debug.enabled = true;

const PORT = 4004;

const name = process.argv[2] || 'pablo';

fetch(`http://localhost:${PORT}/login/${name}`)
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
        function send(type: string, message: any) {
            client.send(JSON.stringify({type, message}));
        }

        // On open, send the token
        client.on('open', () => {
            debug('open');
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


