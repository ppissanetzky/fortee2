
import assert from 'node:assert';


import type User from './user';
import { makeDebug } from './utility';
import GameRoom from './game-room';

export default class UserHandler {

    private readonly user: User;
    private readonly debug = makeDebug('user');

    private gameRoom?: GameRoom;

    constructor(user: User) {
        this.user = user;
        this.debug = this.debug.extend(user.name);

        user.on('createGame', () => {
            if (this.gameRoom) {
                throw new Error(`${this.name} already has a game room`);
            }
            this.gameRoom = new GameRoom(this.user);
            this.user.gone.then(() => this.gameRoom = undefined);
        });
    }

    get name() {
        return this.user.name;
    }
}
