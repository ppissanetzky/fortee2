import { WebSocket } from 'ws';
import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';

import { makeDebug } from './utility';
import type { TableUpdate, TournamentUpdate, UserUpdate } from './tournament-pusher';
import type { Message } from './chatter';
import WsServer from './ws-server';
import Dispatcher from './dispatcher';
import type { GameStatus } from './tournament-driver';
import User, { UserType } from './users';

interface Online {
    value: string;
    text: string;
    type: UserType;
}

interface PushMessages {
    /** Sends an object with all users online, key is id, value is name */
    online: Online[];

    /** A tournament update */
    tournament: TournamentUpdate;

    /** An updated list of tournaments */
    tournaments: TournamentUpdate[];

    /** An update specific to a user for a tournament */
    user: UserUpdate;

    /** Status update for one game */
    game: GameStatus;

    /** Table status, empty, t, hosting or invited */
    table: TableUpdate;

    /** A chat message */
    chat: Message;

    /** Chat history */
    chatHistory: Message[];
}

interface Connection {
    user: User;
    sockets: Set<WebSocket>;
}

type Key = keyof PushMessages;

type ForEachCallback<T extends Key> = (id: string) => PushMessages[T] | undefined;

interface PushServerEvents {
    /** The user ID and WS for a new connection */
    connected: {
        userId: string;
        ws: WebSocket;
    }

    /** The user ID when their last connection is closed */
    disconnected: string;
}

export default class PushServer extends Dispatcher<PushServerEvents> {

    private debug = makeDebug('push');

    private connections = new Map<string, Connection>();

    public upgrade() {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const [ws, user] = await WsServer.get().upgrade(req);
                this.connected(user, ws);
            }
            catch (error) {
                next(error);
            }
        };
    }

    public has(id: string): boolean {
        return this.connections.has(id);
    }

    get userIds(): string [] {
        return Array.from(this.connections.keys());
    }

    public close(userId: string) {
        const existing = this.connections.get(userId);
        if (existing) {
            for (const socket of existing.sockets.values()) {
                socket.close(4000, 'blocked');
            }
            this.connections.delete(userId);
        }
    }

    private disconnected(id: string, name: string, ws: WebSocket) {
        const existing = this.connections.get(id);
        if (existing && existing.sockets.delete(ws)) {
            this.debug('disconnected', id, name);
            if (existing.sockets.size === 0) {
                this.connections.delete(id);
                this.pushOnline();
                this.emit('disconnected', id);
            }
        }
    }

    private connected(user: User, ws: WebSocket) {

        const { id, name} = user;

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
            existing.user = user;
            existing.sockets.add(ws);
            this.pushOnline(id);
        }
        else {
            this.connections.set(id, {user, sockets: new Set([ws])});
            this.pushOnline();
        }
        this.emit('connected', {
            userId: id,
            ws
        });
    }

    private pushOnline(userId?: string) {
        const message: Online[] =
            _.sortBy(Array.from(this.connections.values())
            .map(({user: { id, name, type}}) => ({
                value: id,
                text: name,
                type
            })), 'text');
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
        for (const {user: {id, name}, sockets} of this.connections.values()) {
            this.debug('=>', id, name, type);
            for (const ws of sockets.values()) {
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
                this.debug('=>', c.user.id, c.user.name, type);
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
        for (const {user: {id, name}, sockets} of this.connections.values()) {
            const message = cb(id);
            if (message) {
                this.debug('=>', id, name, type);
                const payload = JSON.stringify({type, message});
                for (const ws of sockets.values()) {
                    ws.send(payload);
                }
            }
        }
    }
}
