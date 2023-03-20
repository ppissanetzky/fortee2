import ms from 'ms';
import { WebSocket, WebSocketServer } from 'ws';

import { makeDebug, makeToken } from './utility';

/**
 * This is how long an invitation to connect from the web
 * server is valid.
 */

const INVITATION_EXPIRY = ms('30s');

//------------------------------------------------------------------------------

const debug = makeDebug('wss');

export interface Connection {
    readonly name: string;
}

export default class WsServer {

    public readonly port: number;

    private invitations = new Map<string, Connection>();

    constructor(port: number) {
        const wss = new WebSocketServer({port});

        this.port = port;

        wss.on('connection', (ws: WebSocket) => {
            debug('connect');
            // Listen for the first message, which should be an invitation token
            ws.once('message', (data) => {
                const token = data.toString();
                debug('message', token);
                const connection = this.invitations.get(token);
                if (!connection) {
                    debug('invalid token, closing');
                    ws.close();
                    return;
                }
                // Otherwise, it is a good connection
                const { name } = connection;
                // Attach pongs
                ws.on('pong', () => {
                    debug('pong');
                });

                // Listen to all messages
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        debug('message', name, message);
                        // TODO: where does it go?
                    }
                    catch (error) {
                        debug('invalid message', name, error, data.toString());
                    }
                });
            });
        });

        setInterval(() => {
            const message = JSON.stringify({
                ping: new Date().toString()
            });
            wss.clients.forEach((ws) => {
                debug('ping');
                ws.send(message);
                ws.ping();
            });
        }, ms('30m'));

        debug('started at', port);
    }

    invite(connection: Connection): string | undefined {
        const { name } = connection;
        // Make sure there is no existing invitation for this "name"
        for (const other of this.invitations.values()) {
            if (other.name === name) {
                debug('existing invitation for', name);
                return undefined;
            }
        }
        // Make a token and ensure it doesn't exist
        let token = makeToken();
        while (this.invitations.get(token)) {
            token = makeToken();
        }
        this.invitations.set(token, connection);
        debug('added invitation for', name, token);
        setTimeout(() => {
            this.invitations.delete(token);
            debug('expired invitation for', name, token);
        }, INVITATION_EXPIRY);
        return token;
    }
}

//-----------------------------------------------------------------------------
// Control messages that are broadcast to all the WS clients
//-----------------------------------------------------------------------------

// app.post('/control', (req, res) => {
//     const {body} = req;
//     console.log('WS control', body.type);
//     const data = JSON.stringify(body);
//     wss.clients.forEach((ws) => {
//         ws.send(data);
//     });
//     res.status(200).end();
// });

//-----------------------------------------------------------------------------

