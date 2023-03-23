import assert from 'node:assert';
import { makeDebug, makeToken } from './utility';
import type User from './user';
import Player from './player';
import RandomBot, { PassBot } from './random-bot';
import RemotePlayer from './remote-player';
import GameDriver, { Rules } from './driver';

export default class GameRoom {

    private static ID = 1000;

    public readonly id = `${GameRoom.ID++}`;

    public readonly host: string;
    public readonly users = new Map<string, User>();
    public readonly bots = new Map<string, Player>();

    private started = false;

    private readonly debug = makeDebug('game-room');
    private readonly token = makeToken();

    constructor(host: User) {
        this.debug = this.debug.extend(this.id);
        this.debug('created');
        this.host = host.name;
        this.join(host, this.token);

        host.on('inviteBot', ({fillRoom}) => {
            assert(this.size < 4, 'Room is full');
            assert(!this.started, 'Game has already started');
            const size = fillRoom ? 4 : this.size + 1;
            while (this.size < size ) {
                const bot = new PassBot();
                const { name } = bot;
                this.bots.set(name, bot);
                this.debug('added bot', name);
                this.all((user) => user.send('enteredGameRoom', {name}));
            }
            if (this.size === 4) {
                this.all((user) => user.send('gameRoomFull', null));
            }
        });

        host.on('startGame', () => {
            assert(this.size === 4, 'Room is not full');
            assert(!this.started, 'A game has already started');
            const players: Player[] = [];
            for (const user of this.users.values()) {
                players.push(new RemotePlayer(user));
            }
            for (const bot of this.bots.values()) {
                players.push(bot);
            }
            this.started = true;
            GameDriver.start(new Rules(), players)
                .finally(() => this.started = false);
        });
    }

    get size(): number {
        return this.users.size + this.bots.size;
    }

    private all(cb: (user: User) => void) {
        for (const user of this.users.values()) {
            cb(user);
        }
    }

    private not(name: string, cb: (user: User) => void) {
        this.all((user) => {
            if (user.name !== name) {
                cb(user);
            }
        });
    }

    private join(user: User, token: string) {
        const { name } = user;
        assert(!this.users.has(name), `User "${name}" exists`);
        assert(!this.bots.has(name), `User "${name}" has existing bot name`);
        assert(this.size < 4, 'Game room is full');
        assert(token === this.token, 'Token mismatch');
        this.debug('joined', name);
        this.users.set(name, user);
        // If and when the user leaves
        user.gone.then(() => {
            this.users.delete(name);
            this.debug('removed', name);
            this.not(name, (other) => {
                other.send('leftGameRoom', {name});
            });
        });
        // Tell everyone else that this user is here
        this.not(name, (other) => other.send('enteredGameRoom', {name}));
        // Tell the user about the room
        user.send('youEnteredGameRoom', null);
        // Is it full?
        if (this.size === 4) {
            this.all((user) => user.send('gameRoomFull', null));
        }
    }
}

