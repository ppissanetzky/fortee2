
export default interface OutgoingMessages {
    welcome: null;

    /**
     * Tell the user that just entered a game room, and give them
     * details about the room.
     */

    youEnteredGameRoom: null;

    /**
     * Tell everyone else that this user has entered the game room
     */

    enteredGameRoom: {
        name: string;
    }

    /**
     * Tell everyone else this user has left
     */

    leftGameRoom: {
        name: string;
    }

    /**
     * The game room is full
     */

    gameRoomFull: null
}
