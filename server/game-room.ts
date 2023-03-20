
import { WebSocket, RawData } from 'ws';
import { Debugger, makeDebug, makeToken } from './utility';

interface HumanPlayer {
    readonly name: string;
    readonly ws: WebSocket;
}

interface Bot {
    readonly name: string;
}

type Listener = (data: RawData, isBinary: boolean) => void;

export default class GameRoom {

    private static ID = 1000;

    public readonly id = `${GameRoom.ID++}`;
    public readonly token = makeToken();

    public readonly humans: HumanPlayer[] = [];
    public readonly bots: Bot[] = [];

    private readonly debug: Debugger;
    private readonly listeners = new Map<HumanPlayer, Listener>();

    constructor() {
        this.debug = makeDebug('game-room').extend(this.id);
        this.debug('created room');
    }

    get size(): number {
        return this.humans.length + this.bots.length;
    }

    private remove(player: HumanPlayer): void {
        const listener = this.listeners.get(player);
        if (listener) {
            this.debug('removing player', player.name);
            player.ws.off('message', listener);
            this.listeners.delete(player);
            // TODO: notify others
        }
        else {
            this.debug('remove: no listener for', player.name);
        }
    }

    join(player: HumanPlayer, token: string) {
        if (this.humans.some(({name}) => name === player.name)) {
            throw new Error(`Human "${player.name}" already joined`);
        }
        if (this.bots.some(({name}) => name === player.name)) {
            throw new Error(`Human "${player.name}" has existing bot name`);
        }
        if (this.size >= 4) {
            throw new Error('Game room is full');
        }
        if (token !== this.token) {
            throw new Error('Token mismatch');
        }
        this.debug('joined', player.name);
        this.humans.push(player);
        const listener = (data: RawData) => {
            const s = data.toString();
            this.debug('ws message from', player.name, s);
            this.message(player, JSON.parse(s));
        };
        this.listeners.set(player, listener);
        player.ws.on('message', listener);
        player.ws.once('close', () => {
            this.debug('ws close for', player.name);
            this.remove(player);
        });
        // TODO: notify others
    }

    message(player: HumanPlayer, message: Record<string, any>) {
        //
    }

}

