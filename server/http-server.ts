import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

import type { Express } from 'express';

import config from './config';

export class HttpServer {
    static create(app: Express) {
        let server: https.Server | http.Server;
        const PORT = process.env.FT_PORT || '4004';
        if (PORT === '443') {
            server = https.createServer({
                key: fs.readFileSync('./certs/privkey.pem'),
                cert: fs.readFileSync('./certs/fullchain.pem'),
            }, app)
            .listen(PORT, () => console.log(`fortee2 ready with https at port ${PORT}`));
        }
        else {
            if (config.PRODUCTION) {
                console.error('Not starting HTTP server in production');
                return process.exit(1);
            }
            server = http.createServer(app).listen(PORT, () => {
                console.log(`fortee2 ready with http at port ${PORT}`);
            });
        }

        /** Graceful shutdown for Docker */

        process.on('SIGTERM', () => {
            console.log('Received SIGTERM, shutting down...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
    }
}
