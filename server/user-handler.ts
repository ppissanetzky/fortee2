import assert from 'node:assert';

import type Socket from './socket';
import { makeDebug } from './utility';
import GameRoom from './game-room';

/**
 * This one handles all the incoming "user" messages. Thos outside of a
 * game room.
 */

export default class UserHandler {

    private readonly socket: Socket;
    private readonly debug = makeDebug('user');

    private gameRoom?: GameRoom;

    constructor(socket: Socket) {
        this.socket = socket;
        this.debug = this.debug.extend(socket.name);

        this.socket.gone.then(() => this.gameRoom = undefined);

        socket.on('createGame', () => {
            assert(!this.gameRoom, `${this.name} already has a game room`);
            this.gameRoom = new GameRoom(this.socket);
        });

        socket.on('joinGame', ({id}) => {
            assert(!this.gameRoom, `${this.name} already has a game room`);
            const room = GameRoom.rooms.get(id);
            assert(room, `Room ${id} not found`);
            room.join(this.socket);
            this.gameRoom = room;
        });
    }

    get name() {
        return this.socket.name;
    }
}
