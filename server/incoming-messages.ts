
export default interface IncomingMessages {
    createGame: object;
    doSomethingElse: {id: number};
}

export type IncomingHandlers = {
    [K in keyof IncomingMessages]:
        (message: IncomingMessages[K]) => void | Promise<void>;
}
