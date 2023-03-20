
import type { IncomingHandlers } from './incoming-messages';
import type IncomingMessages from './incoming-messages';
import type User from './user';
import { makeDebug } from './utility';
import GameRoom from './game-room';

export default class UserHandler implements IncomingHandlers {

    private readonly user: User;
    private readonly debug = makeDebug('user');

    private gameRoom?: GameRoom;

    constructor(user: User) {
        this.user = user;
        this.debug = this.debug.extend(user.name);
    }

    get name() {
        return this.user.name;
    }

    handle(type: keyof IncomingMessages, message: any) {
        this.debug('<-', type, message);
        const handler = this[type];
        if (!handler) {
            return this.debug('invalid type', type);
        }
        handler.call(this, message);
    }

    createGame(message: object) {
        if (this.gameRoom) {
            throw new Error(`${this.name} already has a game room`);
        }
        this.gameRoom = new GameRoom();
        this.gameRoom.join(this.user, this.gameRoom.token);
        this.user.gone.then(() => this.gameRoom = undefined);
    }

    doSomethingElse(message: { id: number }) {
        //
    }
}
