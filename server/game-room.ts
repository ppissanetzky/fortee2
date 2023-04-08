import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';

import ms from 'ms';

import { expected, makeDebug, makeToken } from './utility';
import type Socket from './socket';
import Player from './player';
import RemotePlayer from './remote-player';
import ProductionBot from './production-bot';
import GameDriver, { Rules, SaveWithMetadata } from './driver';
import type { RoomUpdate } from './outgoing-messages';
import { SaveHelper } from './core/save-game';
import Dispatcher from './dispatcher';
import { TableBuilder } from './table-helper';
import config from './config';
import sanitize from 'sanitize-filename';

const enum State {
    /**
     * Before the game starts
     */

    WAITING,

    /**
     * The game is going and all players are connected
     */

    PLAYING,

    /**
     * When a player disconnects, the game is paused
     */

    PAUSED,

    /**
     * Once the game is over
     */

    OVER,
}

export interface GameRoomEvents {
    gameOver: {
        bots: number;
        save: SaveHelper;
    },
    expired: void;
}

/**
 * This one handles the messages for all users in a game room
 */

export default class GameRoom extends Dispatcher <GameRoomEvents> {

    private static ID = 1000;

    /**
     * A map of all the game rooms that are "active" by token
     */

    public static readonly rooms = new Map<string, GameRoom>();

    /**
     * A token for this room
     */

    public readonly token = makeToken(32, 'base64url');

    public readonly id = GameRoom.ID++;

    public readonly url: string;

    public readonly rules: Rules;

    public readonly table: TableBuilder;

    public readonly host: string;

    private readonly positions: string[];

    public readonly sockets = new Map<string, Socket>();

    public readonly bots = new Map<string, Player>();

    private players: Player[] = [];

    private state: State = State.WAITING;

    private readonly debug = makeDebug('game-room');

    /**
     * A set of user names that have been invited to this room. Always
     * includes the host
     */
    public readonly invited = new Set<string>();

    constructor(rules: Rules, table: TableBuilder) {
        super();
        this.url = `${config.FT2_SERVER_BASE_URL}/game/${this.token}`;
        this.table = table;
        this.host = expected(expected(table.host).name);
        GameRoom.rooms.set(this.token, this);
        this.rules = rules;
        this.debug = this.debug.extend(String(this.id));
        this.debug('created %s for %j', this.token, table.table);
        this.debug('rules %o', rules);

        this.positions = table.table.map((user) => {
            if (user) {
                const name = expected(user.name);
                this.invited.add(name);
                return name;
            }
            const bot = new ProductionBot();
            this.bots.set(bot.name, bot);
            return bot.name;
        });

        assert(this.positions.every((name) => name), 'Positions are wrong');
        this.debug('positions %j', this.positions);

        setTimeout(() => {
            if (!this.started) {
                this.debug('expired for %j', this.table);
                GameRoom.rooms.delete(this.token);
                this.emit('expired', undefined);
            }
        }, ms(config.FT2_SLACK_INVITATION_EXPIRY))
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

    private all(cb: (user: Socket) => void) {
        this.sockets.forEach(cb);
    }

    private not(name: string, cb: (user: Socket) => void) {
        this.all((user) => {
            if (user.name !== name) {
                cb(user);
            }
        });
    }

    private roomUpdate(socket: Socket): RoomUpdate {
        return {
            hosting: this.host === socket.name,
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
        try {
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
            const save = await GameDriver.start(this.rules, this.players);

            this.saveGame(save);

            this.emit('gameOver', {
                bots: this.bots.size,
                save: new SaveHelper(save),
            });
        }
        catch (error) {
            // TODO: what should we do?
            this.debug('game error', error);
        }
        finally {
            this.state = State.OVER;
            this.players = [];

            /**
             * Remove the room. Players can play again, but the link to it
             * won't work anymore since it won't be in the map
             */

            if (GameRoom.rooms.has(this.token)) {
                this.debug('game over, removing %s for %j', this.token, this.table);
                GameRoom.rooms.delete(this.token);
            }
        }
    }

    public async join(socket: Socket) {
        const { name } = socket;
        assert(!this.names.has(name), `User "${name}" exists`);
        assert(!this.full, 'Game room is full');
        assert(this.invited.has(name), `User "${name}" has not been invited`);
        this.debug('joined', name);
        this.sockets.set(name, socket);
        // If and when the user leaves
        socket.gone.then((reason) => {
            this.sockets.delete(name);
            this.debug('removed', name, 'have', this.size);
            if (this.state === State.PLAYING) {
                this.state = State.PAUSED;
            }
            if (name === this.host && reason === 'host-close' && this.state === State.OVER) {
                this.not(name, (other) => other.close('host-close'));

            }
            this.not(name, (other) => {
                other.send('leftGameRoom', {
                    name,
                    ...this.roomUpdate(other),
                });
            });
        });
        // Look for playAgain from the host
        if (name === this.host) {
            socket.on('playAgain', () => {
                assert(this.state === State.OVER);
                this.state = State.PLAYING;
                this.run();
            });
        }
        // Notify everyone
        const notify = () => {
            // Tell everyone else that this user is here
            this.not(name, (other) => other.send('enteredGameRoom', this.roomUpdate(other)));
            // Tell the user about the room
            socket.send('youEnteredGameRoom', this.roomUpdate(socket));
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
            this.run();
        }

        // The game is paused, but everyone just came back, so we can
        // automatically resume it

        else if (this.state === State.PAUSED) {
            this.state = State.PLAYING;
            // Tell everyone of the state change
            notify();
            // Now, reset the socket
            this.sockets.forEach((socket) => {
                // Find the player with the same name
                const player = this.players.find(({name}) =>
                    name === socket.name);
                assert(player, `Player ${socket.name} not found in players list`);
                assert(player instanceof RemotePlayer, `Player ${socket.name} is not remote`);
                // Reset this player's socket - it'll do nothing if it's the
                // same as before
                player.reset(socket);
            });
        }

        // TODO: rejoin after the game is over?
    }

    private async saveGame(save: SaveWithMetadata) {
        try {
            const name = sanitize(new Date(save.started).toISOString(), {
                replacement: '-'
            }).replace('.', '-') + '.json';
            const contents = JSON.stringify(save);
            await fs.writeFile(path.join(config.FT2_SAVE_PATH, name), contents);
            this.debug('saved', name);
        }
        catch(error) {
            this.debug('failed to save game', error);
        }
    }
}

