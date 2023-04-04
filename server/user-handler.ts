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

        socket.on('joinGame', ({token}) => {
            if (this.gameRoom) {
                this.debug('already has a game room');
                return this.socket.send('badRoom', undefined);
            }
            const room = GameRoom.rooms.get(token);
            if (!room) {
                this.debug(`room ${token} not found`);
                return this.socket.send('badRoom', undefined);
            }
            room.join(this.socket);
            this.gameRoom = room;
        });
    }

    get name() {
        return this.socket.name;
    }
}
