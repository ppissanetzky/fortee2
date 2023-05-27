import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';

import ms from 'ms';

import { expected, makeDebug, makeToken } from './utility';
import Socket from './socket';
import Player from './player';
import RemotePlayer from './remote-player';
import ProductionBot from './production-bot';
import GameDriver, { Rules, TimeOutError, Status,
    GameDriverEvents, StopError, Game, Team } from './driver';
import type { EndOfHand, GameIdle, GameMessages, RoomUpdate } from './outgoing-messages';
import saveGame, { SaveWithMetadata } from './core/save-game';
import Dispatcher from './dispatcher';
import { TableBuilder } from './table-helper';
import config from './config';
import sanitize from 'sanitize-filename';
import Tournament from './tournament';
import { gameState } from './game-state';
import ServerStatus from './server-status';
import { writeStat } from './stats';
import * as db from './tournament-db';
import { getUnixTime } from 'date-fns';


const enum State {
    /**
     * Before the game starts
     */

    WAITING = 'waiting',

    /**
     * The game is going and all players are connected
     */

    PLAYING = 'playing',

    /**
     * When a player disconnects, the game is paused
     */

    PAUSED = 'paused',

    /**
     * Once the game is over
     */

    OVER = 'over',
}

/** Should be JSON-able */

export interface UserStatus {
    id: string;
    name: string;
    connected: boolean;
    /** How many outstanding socket messages for this user */
    outstanding: number;
}

/** Should be JSON-able */

export interface TeamStatus {
    marks: number;
    team: UserStatus[];
}

/** Should be JSON-able */

export interface GameRoomStatus {
    id: number;
    state: string;
    idle: number;
    us: TeamStatus;
    them: TeamStatus;
    token: string;
}

export interface GameRoomEvents extends GameDriverEvents {
    /** The user ID that just joined, could happen many times */
    userJoined: string;
    /** The user ID that disconnected, could happen many times */
    userLeft: string;
    gameStarted: void;
    gamePaused: void;
    gameResumed: void;
    gameOver: {
        bots: number;
        winningTeam: Team;
    },
    gameError: unknown;
    expired: GameRoomStatus;
    closed: undefined;
    endOfHand: EndOfHand;
    gameIdle: GameIdle;
}

export interface ChatMessage {
    name: string;
    text: string;
}

export interface GameRoomOptions {
    rules: Rules;
    table: TableBuilder;
    tournament?: Tournament;
}

interface GlobalGameRoomEvents {
    created: GameRoom;
    closed: GameRoom;
}

interface Latency {
    time: number;
    count: number;
}

/**
 * This one handles the messages for all users in a game room
 */

export default class GameRoom extends Dispatcher <GameRoomEvents> {

    /** If it is a bot, returns its name */

    static isBot(id: string): string | undefined {
        if (id.startsWith(':bot:')) {
            return id.substring(5);
        }
    }

    private static ID = 1000;

    /** A map of all the game rooms that are "active" by token */

    public static readonly rooms = new Map<string, GameRoom>();

    /** An emitter of global game room events */

    public static readonly events = new Dispatcher<GlobalGameRoomEvents>();

    /**
     * A token for this room
     */

    public readonly token: string;

    public readonly id = GameRoom.ID++;

    public readonly rules: Rules;

    public readonly table: TableBuilder;

    public readonly host: string;

    public readonly positions: string[];

    public readonly sockets = new Map<string, Socket>();

    public readonly bots = new Map<string, Player>();

    private players: Player[] = [];

    private game?: Game;

    private state: State = State.WAITING;

    private gameStatus?: Status;

    private gameIdle?: number;

    private readonly debug = makeDebug('game-room');

    public readonly options: GameRoomOptions;

    public readonly gone: Promise<void>;

    private watchers = new Set<Socket>();

    private chat: ChatMessage[] = [];

    /**
     * A set of user names that have been invited to this room. Always
     * includes the host
     */
    public readonly invited = new Set<string>();

    /** Latency of alive messages per user name */

    public readonly latencies = new Map<string, Latency>();

    constructor(options: GameRoomOptions) {
        super();
        this.token = makeToken(16, 'base64url');
        while (GameRoom.rooms.has(this.token)) {
            this.token = makeToken(16, 'base64url');
        }
        GameRoom.rooms.set(this.token, this);
        this.options = options;
        const { rules, table } = options;
        this.table = table;
        this.host = expected(expected(table.host).name);
        this.rules = rules;
        this.debug = this.debug.extend(String(this.id));
        this.debug('created %s for %j', this.token, table.table);
        this.debug('rules %o', rules);

        this.gone = new Promise((resolve) => {
            const listener = () => {
                this.off('expired', listener);
                this.off('gameError', listener);
                this.off('gameOver', listener);
                resolve();
            };
            this.once('expired', listener);
            this.once('gameError', listener);
            this.once('gameOver', listener);
        });

        this.positions = table.table.map((user, index) => {
            if (user) {
                const name = expected(user.name);
                if (GameRoom.isBot(user.id)) {
                    const bot = new ProductionBot(name);
                    this.bots.set(name, bot);
                    return name;
                }
                this.invited.add(name);
                return name;
            }
            const bot = new ProductionBot();
            table.table[index] = {
                id: bot.id,
                name: bot.name
            };
            this.bots.set(bot.name, bot);
            return bot.name;
        });

        assert(this.positions.every((name) => name), 'Positions are wrong');
        this.debug('positions %j', this.positions);

        GameRoom.events.emit('created', this);

        const aliveInterval = setInterval(() => {
            this.all((socket) => {
                const start = Date.now();
                socket.send('alive', null, 'readyToContinue').then(() => {
                    const time = Date.now() - start;
                    writeStat('gr-latency', socket.userId, time);
                    const latency = this.latencies.get(socket.name);
                    if (!latency) {
                        this.latencies.set(socket.name, {time, count: 1});
                    } else {
                        latency.time += time;
                        latency.count += 1;
                    }
                });
            })
        }, ms('25s'));

        this.once('closed', () => {
            clearInterval(aliveInterval);
            GameRoom.events.emit('closed', this);
            this.emitter.removeAllListeners();
            for (const watcher of this.watchers.values()) {
                watcher.close('game-over');
            }
            this.watchers.clear();
        });

        setTimeout(() => {
            if (!this.started) {
                this.expire();
            }
        }, ms(config.FT2_GAME_EXPIRY))

        /** If the room is just bots, start it now */
        if (this.bots.size === 4) {
            this.state = State.PLAYING;
            this.run();
        }
    }

    get t(): Tournament | undefined {
        return this.options.tournament;
    }

    get url(): string {
        return `${config.FT2_SITE_BASE_URL}/play?join=${this.token}`;
    }

    get size(): number {
        return this.sockets.size + this.bots.size;
    }

    get names(): Set<string> {
        return new Set([
            ...Array.from(this.sockets.keys()),
            ...Array.from(this.bots.keys()),
        ]);
    }

    get full(): boolean {
        return this.size === 4;
    }

    get started(): boolean {
        switch (this.state) {
            case State.PLAYING:
            case State.PAUSED:
                return true;
        }
        return false;
    }

    /** The user IDs that have sockets */

    get connected(): string[] {
        return Array.from(this.sockets.values()).map(({userId}) => userId);
    }

    get status(): GameRoomStatus {
        const team = (indices: number[]) => indices.map((i) => {
            const name = this.positions[i];
            const id = expected(this.table.idFor(name));
            const socket = this.sockets.get(name);
            const connected = GameRoom.isBot(id) ? true : Boolean(socket);
            const outstanding = socket?.outstanding.length || 0;
            return { id, name, connected, outstanding };
        });
        return {
            id: this.id,
            token: this.token,
            state: this.state,
            idle: this.gameIdle || 0,
            us: {
                marks: this.gameStatus?.US.marks || 0,
                team: team([0, 2])
            },
            them: {
                marks: this.gameStatus?.THEM.marks || 0,
                team: team([1, 3])
            }
        }
    }

    /** Allows an invited user to decline the invitation */

    public decline(userId: string, name: string): boolean {
        if (!this.table.has(userId)) {
            return false;
        }
        if (this.t) {
            return false;
        }
        this.all((socket) => socket.send('declined', {
            id: userId,
            name
        }));
        this.expire('declined');
        return true;
    }

    /** Just players */

    private all(cb: (user: Socket) => void) {
        this.sockets.forEach(cb);
    }

    /** Includes watchers */

    private everyone(cb: (user: Socket) => void) {
        this.all(cb);
        this.watchers.forEach(cb);
    }

    private not(name: string, cb: (user: Socket) => void) {
        this.all((user) => {
            if (user.name !== name) {
                cb(user);
            }
        });
    }

    private roomUpdate(target: {name: string}): RoomUpdate {
        return {
            hosting: this.host === target.name,
            full: this.full,
            started: this.started,
            paused: this.state === State.PAUSED,
            players: [...this.positions],
            bots: [...this.bots.keys()],
            connected: [
                ...Array.from(this.sockets.keys()),
                ...Array.from(this.bots.keys())
            ]
        };
    }

    private async run() {
        const started = Date.now();
        let reason = 'game-over';
        try {
            this.emit('gameStarted', undefined);
            // Create the players
            this.players = this.positions.map((name) => {
                const socket = this.sockets.get(name);
                if (socket) {
                    return new RemotePlayer(socket);
                }
                const bot = this.bots.get(name);
                assert(bot, `"${name}" is missing`);
                return bot;
            });
            // Start'er up
            const driver = new GameDriver(this.rules, this.players,
                    ms(config.FT2_GAME_EXPIRY));

            this.game = driver.game;

            driver.on('endOfHand', (msg) => {
                this.gameStatus = msg.status;
                this.gameIdle = 0;
                this.emit('endOfHand', msg);
            });

            driver.on('gameIdle', (msg) => {
                const { time } = msg;
                this.gameIdle = time > 0 ? time : undefined;
                this.emit('gameIdle', msg);
                this.debug('idle %j', msg);
            });

            this.once('closed', () => {
                this.debug('stopping driver');
                driver.stop();
            });

            driver.onAll((event) => {
                const { type , message } = event;
                this.watchers.forEach((socket) =>
                    socket.send(type as keyof GameMessages, message));
            });

            await driver.run();

            this.emit('gameOver', {
                bots: this.bots.size,
                winningTeam: expected(driver.game.winningTeam),
            });
        }
        catch (error) {
            if (error instanceof StopError) {
                /** Do nothing, we stopped it */
            }
            else if (error instanceof TimeOutError) {
                this.debug('game expired', error.message);
                this.emit('expired', this.status);
                reason = 'game-expired';
            }
            else {
                this.debug('game error', error);
                this.emit('gameError', error);
                reason = 'game-error';
            }
        }
        finally {
            try {
                this.saveGame({
                    ...saveGame(expected(this.game)),
                    bots: this.players.filter(({human}) => !human).map(({name}) => name),
                    started,
                    ended: Date.now(),
                    chat: this.chat,
                    tid: this.t?.id
                });
            } catch (error) {
                this.debug('Failed to save game', error);
            }
            this.state = State.OVER;
            this.players = [];
            this.game = undefined;

            /** Remove the room */

            if (GameRoom.rooms.delete(this.token)) {
                this.debug('game over, removing %s for %j', this.token, this.table);
            }

            /**
             * Close all the sockets now. This will help with players leaving
             * tabs open and being unable to get into the next game.
             */

            this.all((socket) => socket.close(reason));
            this.sockets.clear();

            /** Will remove all listeners */

            this.emit('closed', undefined);
        }
    }

    public addWatcher(socket: Socket) {
        const { userId, name } = socket;
        this.watchers.add(socket);
        this.debug('added watcher', userId, name);
        socket.gone.then(() => {
            this.debug('removed watcher', userId, name);
            this.watchers.delete(socket);
        });
        /** Only watchers that are TDs can chat */
        if (socket.user.isTD) {
            socket.on('chat', (message) => this.sendChat(name, message));
        }
        /** When the user joins, we send them all the existing chat messages */
        socket.send('chat', this.chat);
        /** Tell the user about the room */
        socket.send('youEnteredGameRoom', this.roomUpdate(socket));
        /** Send them the game state */
        if (this.game) {
            socket.send('gameState', gameState(this.game, name));
        }
    }

    public async join(socket: Socket) {
        const { userId, name } = socket;
        if (socket.isWatcher) {
            return this.addWatcher(socket);
        }
        assert(!this.names.has(name), `User "${name}" exists`);
        assert(!this.full, 'Game room is full');
        assert(this.invited.has(name), `User "${name}" has not been invited`);
        this.debug('joined', name);
        this.sockets.set(name, socket);
        this.emit('userJoined', userId);
        /**
         * When the user sends us a chat message, we save it and then send it
         * to everyone
         */
        socket.on('chat', (message) => this.sendChat(name, message));
        /** When the user joins, we send them all the existing chat messages */
        socket.send('chat', this.chat);
        // If and when the user leaves
        socket.gone.then((reason) => {
            if (this.sockets.delete(name)) {
                this.emit('userLeft', userId);
                this.debug('removed', name, userId, ': reason', reason);
                this.everyone((other) => {
                    if (other.name !== name) {
                        other.send('leftGameRoom', {
                            name,
                            ...this.roomUpdate(other),
                        });
                    }
                });
            }
            if (this.state === State.PLAYING) {
                this.state = State.PAUSED;
                this.emit('gamePaused', undefined);
            }
            /**
             * When the reason is reply-delayed, we closed the socket and
             * expect the client to re-connect, so we keep the room around
             */
            if (reason !== 'reply-delayed') {
                if (this.sockets.size === 0 && !this.t && this.started) {
                    this.debug('everyone gone, closing');
                    this.expire();
                }
            }
        });
        // Notify everyone
        const notify = () => {
            // Tell everyone else that this user is here, including watchers
            this.everyone((socket) => {
                if (socket.name !== name) {
                    socket.send('enteredGameRoom', this.roomUpdate(socket));
                }
            })
            // Tell the user about the room
            socket.send('youEnteredGameRoom', this.roomUpdate(socket));
            // Send them the game state
            if (this.game) {
                socket.send('gameState', gameState(this.game, name));
            }
        };

        // If it's not full, just notify everyone
        if (!this.full) {
            return notify();
        }

        // Everyone is here and the game is ready to start
        if (this.state === State.WAITING) {
            // Update state
            this.state = State.PLAYING;
            // Notify everyone
            notify();
            // Run the game
            return this.run();
        }

        // The game is paused, but everyone just came back, so we can
        // automatically resume it

        if (this.state === State.PAUSED) {
            this.state = State.PLAYING;
            // Tell everyone of the state change
            notify();
            // Now, reset the socket
            this.sockets.forEach((socket) => {
                // Find the player
                const player = this.players.find(({id}) =>
                    id === socket.userId);
                assert(player, `Player ${socket.name} not found in players list`);
                assert(player instanceof RemotePlayer, `Player ${socket.name} is not remote`);
                // Reset this player's socket - it'll do nothing if it's the
                // same as before
                player.reset(socket);
            });
            this.emit('gameResumed', undefined);
        }
    }

    private sendChat(name: string, text: string) {
        const chat = {name, text};
        this.chat.push(chat);
        this.everyone((socket) => socket.send('chat', [chat]));
    }

    private async saveGame(save: SaveWithMetadata) {
        try {
            const date = new Date(save.started).toISOString();
            const players = save.players.join('-').toLowerCase();
            const name = sanitize(`${date}-${players}` , {
                replacement: '-'
            }).replace('.', '-') + '.json';
            const contents = JSON.stringify(save);
            await fs.writeFile(path.join(config.FT2_SAVE_PATH, name), contents);
            db.run(`
                INSERT INTO games VALUES (null, $name, $started, $players, $score, $tid)
            `, {
                name,
                started: getUnixTime(save.started),
                players: save.players.join(','),
                score: `${save.marks.US}-${save.marks.THEM}`,
                tid: save.tid ?? null
            });
            this.debug('saved', name);
        }
        catch(error) {
            this.debug('failed to save game', error);
        }
    }

    private expire(reason = '') {
        if (GameRoom.rooms.has(this.token)) {
            this.state = State.OVER;
            this.debug('expired with reason "%s" for %j', reason, this.table);
            GameRoom.rooms.delete(this.token);
            this.emit('expired', this.status);
            this.all((socket) => socket.close(reason));
            this.sockets.clear();
            this.emit('closed', undefined);
        }
    }
}

const debug = makeDebug('game-room');

GameRoom.events.on('created', (room) => {
    debug('created', room.id, 'for', room.positions,
        'have', GameRoom.rooms.size);
});

GameRoom.events.on('closed', (room) => {
    debug('closed', room.id, 'for', room.positions,
        'have', GameRoom.rooms.size);
});

ServerStatus.publish({
    name: 'Game room latency',
    get() {
        const columns = ['Room', 'User', 'Latency'];
        const rows = [];
        for (const room of GameRoom.rooms.values()) {
            for (const [name, latency] of room.latencies.entries()) {
                rows.push([
                    room.id,
                    name,
                    ms(Math.floor(latency.time / latency.count))
                ]);
            }
        }
        return {columns, rows};
    }
});
