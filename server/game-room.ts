
import { makeDebug, makeToken } from './utility';
import type User from './user';

interface Bot {
    readonly name: string;
}

export default class GameRoom {

    private static ID = 1000;

    public readonly id = `${GameRoom.ID++}`;
    public readonly token = makeToken();

    public readonly users = new Map<string, User>();
    public readonly bots = new Map<string, Bot>();

    private readonly debug = makeDebug('game-room');

    constructor() {
        this.debug = this.debug.extend(this.id);
        this.debug('created');
    }

    get size(): number {
        return this.users.size + this.bots.size;
    }

    all(cb: (user: User) => void) {
        for (const user of this.users.values()) {
            cb(user);
        }
    }

    not(name: string, cb: (user: User) => void) {
        this.all((user) => {
            if (user.name !== name) {
                cb(user);
            }
        })
    }

    join(user: User, token: string) {
        const { name } = user;
        if (this.users.get(name)) {
            throw new Error(`User "${name}" exists`);
        }
        if (this.bots.get(name)) {
            throw new Error(`User "${name}" has existing bot name`);
        }
        if (this.size >= 4) {
            throw new Error('Game room is full');
        }
        if (token !== this.token) {
            throw new Error('Token mismatch');
        }
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
    }
}

