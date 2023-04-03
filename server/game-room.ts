import assert from 'node:assert';

import { makeDebug, makeToken } from './utility';
import type Socket from './socket';
import Player from './player';
import RemotePlayer from './remote-player';
import ProductionBot from './production-bot';
import GameDriver, { Rules } from './driver';
import type { RoomUpdate } from './outgoing-messages';

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

/**
 * This one handles the messages for all users in a game room
 */

export default class GameRoom {

    private static ID = 1000;

    /**
     * A map of all the game rooms that are "active"
     */

    public static readonly rooms = new Map<string, GameRoom>();

    /**
     * A token for this room
     */

    public readonly token = makeToken(32, 'base64url');

    /**
     * Returns an array of all active game rooms that this user
     * has an invitation for
     */

    static roomsForUser(name: string): GameRoom[] {
        return Array.from(this.rooms.values())
            .filter((room) => room.invited.has(name));
    }

    public readonly id = GameRoom.ID++;

    public readonly rules: Rules;

    public readonly host: string;

    private readonly positions: string[] = [];

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

    constructor(rules: Rules, host: string, partner = '', others: string[] = []) {
        assert(host, 'Host cannot be blank');
        GameRoom.rooms.set(this.token, this);
        this.rules = rules;
        this.debug = this.debug.extend(String(this.id));
        this.debug('created for', host, partner, others, this.token);
        this.debug('rules %o', rules);
        this.host = host;

        const nameOrBot = (index: number, name: string) => {
            if (name) {
                this.positions[index] = name;
                this.invited.add(name);
            }
            else {
                const bot = new ProductionBot();
                this.positions[index] = bot.name;
                this.bots.set(bot.name, bot);
            }
        }

        nameOrBot(0, host);
        nameOrBot(1, others[0]);
        nameOrBot(2, partner);
        nameOrBot(3, others[1]);

        assert(this.positions.every((name) => name), 'Positions are wrong');
        this.debug('positions %j', this.positions);
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

    private roomUpdate(): RoomUpdate {
        return {
            full: this.full,
            started: this.started,
            paused: this.state === State.PAUSED,
            players: [...this.positions],
            connected: [
                ...Array.from(this.sockets.keys()),
                ...Array.from(this.bots.keys())
            ]
        };
    }

    public async join(socket: Socket) {
        const { name } = socket;
        assert(!this.names.has(name), `User "${name}" exists`);
        assert(!this.full, 'Game room is full');
        assert(this.invited.has(name), `User "${name}" has not been invited`);
        this.debug('joined', name);
        this.sockets.set(name, socket);
        // If and when the user leaves
        socket.gone.then(() => {
            this.sockets.delete(name);
            this.debug('removed', name, 'have', this.size);
            if (this.state === State.PLAYING) {
                this.state = State.PAUSED;
            }
            this.not(name, (other) => {
                other.send('leftGameRoom', {
                    name,
                    ...this.roomUpdate(),
                });
            });
        });
        // Notify everyone
        const notify = () => {
            // Tell everyone else that this user is here
            this.not(name, (other) => other.send('enteredGameRoom', this.roomUpdate()));
            // Tell the user about the room
            socket.send('youEnteredGameRoom', this.roomUpdate());
        };

        // If it's not full, just notify everyone
        if (!this.full) {
            return notify();
        }

        // Everyone is here and the game is ready to start
        if (this.state === State.WAITING) {
            // Update state
            this.state = State.PLAYING;
            try {
                // Notify everyone
                notify();
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
                await GameDriver.start(this.rules, this.players);
            }
            catch (error) {
                // TODO: what should we do?
                this.debug('game error', error);
            }
            finally {
                // TODO: We have to delete the invitation
                this.state = State.OVER;
                this.players = [];
                this.debug('game over');
            }
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
}

