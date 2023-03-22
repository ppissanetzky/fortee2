
export interface UserMessages {

    /**
     * When a user wants to create and host a game *
     */

    createGame: object;
}

export interface GameRoomMessages {

    /**
     * The host invites bot(s) to the game room
     */

    inviteBot: {
        fillRoom: boolean;
    }
}

export type IncomingMessages = UserMessages & GameRoomMessages;
