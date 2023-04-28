import { WebSocket } from 'ws';
import { NextFunction, Request, Response } from 'express';

import { makeDebug } from './utility';
import type { TableUpdate, TournamentUpdate } from './tournament-pusher';
import WsServer from './ws-server';
import Dispatcher from './dispatcher';

interface PushMessages {
    /** Sends an object with all users online, key is id, value is name */
    online: Record<string, string>;

    /** A tournament update */
    tournament: TournamentUpdate;

    /** An updated list of tournaments */
    tournaments: TournamentUpdate[];

    /** Table status, empty, t, hosting or invited */
    table: TableUpdate;
}

interface Connection {
    id: string;
    name: string;
    sockets: Set<WebSocket>;
}

type Key = keyof PushMessages;

type ForEachCallback<T extends Key> = (id: string) => PushMessages[T] | undefined;

interface PushServerEvents {
    /** The user ID of a new connection */
    connected: string;
}

export default class PushServer extends Dispatcher<PushServerEvents> {

    private debug = makeDebug('push');

    private connections = new Map<string, Connection>();

    public upgrade() {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const [ws, user] = await WsServer.get().upgrade(req);
                this.connected(user.id, user.name, ws);
            }
            catch (error) {
                next(error);
            }
        };
    }

    public has(id: string): boolean {
        return this.connections.has(id);
    }

    private disconnected(id: string, name: string, ws: WebSocket) {
        const existing = this.connections.get(id);
        if (existing && existing.sockets.delete(ws)) {
            this.debug('disconnected', id, name);
            if (existing.sockets.size === 0) {
                this.connections.delete(id);
                this.pushOnline();
            }
        }
    }

    private connected(id: string, name: string, ws: WebSocket) {

        this.debug('connected', id, name);

        ws.once('close', (event) => {
            this.debug('closed', id, name, event);
            this.disconnected(id, name, ws);
        });
        ws.once('error', (error) => {
            this.debug('error', id, name, error);
            this.disconnected(id, name, ws);
            ws.close();
        });

        const existing = this.connections.get(id);

        if (existing) {
            existing.name = name;
            existing.sockets.add(ws);
            this.pushOnline(id);
        }
        else {
            this.connections.set(id, { id, name, sockets: new Set([ws]) });
            this.pushOnline();
        }
        this.emit('connected', id);
    }

    private pushOnline(userId?: string) {
        const message: Record<string, string> = {};
        for (const c of this.connections.values()) {
            message[c.id] = c.name;
        }
        this.debug('online %j', message);
        if (userId) {
            this.pushToOne(userId, 'online', message);
        }
        else {
            this.pushToAll('online', message);
        }
    }

    public pushToAll<T extends Key>(type: T, message: PushMessages[T]) {
        const payload = JSON.stringify({ type, message });
        for (const c of this.connections.values()) {
            this.debug('=>', c.id, c.name, type);
            for (const ws of c.sockets.values()) {
                ws.send(payload);
            }
        }
    }

    public pushToMany<T extends Key>(
        ids: string[], type: T, message: PushMessages[T])
    {
        const payload = JSON.stringify({type, message});
        const list = ids.map((id) => this.connections.get(id));
        for (const c of list) {
            if (c) {
                this.debug('=>', c.id, c.name, type);
                for (const ws of c.sockets.values()) {
                    ws.send(payload);
                }
            }
        }
    }

    public pushToOne<T extends Key>(
        id: string, type: T, message: PushMessages[T])
    {
        this.pushToMany([id], type, message);
    }

    public forEach<T extends Key>(type: T, cb: ForEachCallback<T>) {
        for (const c of this.connections.values()) {
            const message = cb(c.id);
            if (message) {
                this.debug('=>', c.id, c.name, type);
                const payload = JSON.stringify({type, message});
                for (const ws of c.sockets.values()) {
                    ws.send(payload);
                }
            }
        }
    }
}
