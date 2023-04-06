import type Socket from './socket';
import { makeDebug } from './utility';
import GameRoom from './game-room';

/**
 * This one handles all the incoming "user" messages. Those outside of a
 * game room.
 */

export default class UserHandler {

    private readonly socket: Socket;
    private readonly debug = makeDebug('user');

    constructor(socket: Socket, gameRoomToken: string) {
        this.socket = socket;
        this.debug = this.debug.extend(socket.name);

        const room = GameRoom.rooms.get(gameRoomToken);
        if (!room) {
            this.debug(`room ${gameRoomToken} not found`);
            this.socket.send('badRoom', undefined);
            this.socket.close();
        }
        else {
            room.join(this.socket);
        }
    }

    get name() {
        return this.socket.name;
    }
}
