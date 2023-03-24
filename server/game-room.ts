import assert from 'node:assert';
import _ from 'lodash';

import { makeDebug } from './utility';
import type Socket from './socket';
import Player from './player';
import RandomBot, { PassBot } from './random-bot';
import RemotePlayer from './remote-player';
import GameDriver, { Rules } from './driver';

const enum State {
    /**
     * Before the game starts or after it is over
     */

    WAITING,

    /**
     * The game is going and all players are connected
     */

    PLAYING,

    /**
     * When a player disconnects, the game is paused
     */

    PAUSED
}

/**
 * This one handles the messages for all users in a game room
 */

export default class GameRoom {

    private static ID = 1000;

    /**
     * A map of all the game rooms that are "active"
     */

    public static readonly rooms = new Map<number, GameRoom>();

    /**
     * Returns an array of all active game rooms that this user
     * has an invitation for
     */

    static roomsForUser(name: string): GameRoom[] {
        return Array.from(this.rooms.values())
            .filter((room) => room.invited.has(name));
    }

    public readonly id = GameRoom.ID++;

    public readonly host: string;
    public readonly sockets: Socket[] = [];
    public readonly bots: Player[] = [];

    public players: RemotePlayer[] = [];

    private state: State = State.WAITING;
    private readonly debug = makeDebug('game-room');

    /**
     * A set of user names that have been invited to this room. Always
     * includes the host
     */
    public readonly invited = new Set<string>();

    constructor(host: Socket) {
        this.debug = this.debug.extend(String(this.id));
        this.debug('created');
        GameRoom.rooms.set(this.id, this);
        this.host = host.name;
        this.invited.add(this.host);
        this.join(host);
    }

    get size(): number {
        return this.sockets.length + this.bots.length;
    }

    get names(): Set<string> {
        return new Set([...this.sockets, ...this.bots]
            .map(({name}) => name));
    }

    get full(): boolean {
        return this.size === 4;
    }

    get started(): boolean {
        return this.state !== State.WAITING;
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

    public join(socket: Socket) {
        const { name } = socket;
        assert(!this.names.has(name), `User "${name}" exists`);
        assert(!this.full, 'Game room is full');
        assert(this.invited.has(name), `User "${name}" has not been invited`);
        this.debug('joined', name);
        this.sockets.push(socket);
        // If and when the user leaves
        socket.gone.then(() => {
            _.pull(this.sockets, socket);
            this.debug('removed', name, 'have', this.size);
            this.not(name, (other) => {
                other.send('leftGameRoom', {name});
            });
            if (this.state === State.PLAYING) {
                this.state = State.PAUSED;
            }
        });
        // Tell everyone else that this user is here
        this.not(name, (other) => other.send('enteredGameRoom', {name}));
        // Tell the user about the room
        socket.send('youEnteredGameRoom', {
            full: this.full,
            started: this.started,
            players: this.sockets.map(({name}) => name),
            bots: this.bots.map(({name}) => name),
        });
        // Is it full?
        if (this.full) {
            this.all((user) => user.send('gameRoomFull', {started: this.started}));

            // The game is paused, but everyone just came back, so we can
            // automatically resume it

            if (this.state === State.PAUSED) {
                this.sockets.forEach((socket) => {
                    // Find the player with the same name
                    const player = this.players.find(({name}) =>
                        name === socket.name);
                    assert(player, `Player ${socket.name} not found in players list`);
                    // Reset this player's socket - it'll do nothing if it's the
                    // same as before
                    player.reset(socket);
                });
            }
        }
        // Now, attach listeners

        if (name === this.host) {
            socket.on('inviteBot', ({fillRoom}) => {
                assert(!this.full, 'Room is full');
                assert(this.state === State.WAITING, 'Game has already started');
                const size = fillRoom ? 4 : this.size + 1;
                while (this.size < size ) {
                    const bot = new PassBot();
                    const { name } = bot;
                    this.bots.push(bot);
                    this.debug('added bot', name);
                    this.all((socket) => socket.send('enteredGameRoom', {name}));
                }
                if (this.full) {
                    this.all((socket) =>
                        socket.send('gameRoomFull', {started: this.started}));
                }
            });

            /**
             * The host wants to start the game
             */

            socket.on('startGame', async () => {
                assert(this.size === 4, 'Room is not full');
                assert(this.state === State.WAITING, 'A game has already started');
                // Un-invite anyone that is not part of this game so that if
                // someone drops out, another previously-invited user cannot
                // steal their place
                this.invited.clear();
                this.sockets.forEach(({name}) => this.invited.add(name));
                // Create the remote players
                this.players = this.sockets.map((socket) => new RemotePlayer(socket));
                // Update state
                this.state = State.PLAYING;
                try {
                    // Start'er up
                    await GameDriver.start(new Rules(),
                        [...this.players, ...this.bots]);
                }
                catch (error) {
                    // TODO: what should we do?
                    this.debug('game error', error);
                }
                finally {
                    this.state = State.WAITING;
                    this.players = [];
                    this.debug('game over');
                }
            });
        }
    }
}

