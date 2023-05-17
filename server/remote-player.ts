import assert from 'node:assert';

import type Player from './player';
import type { Bid , Bone, Team, Trump, Rules } from './core';
import type { Status } from './driver';
import Socket from './socket';
import { GameError, GameIdle } from './outgoing-messages';
import { writeStat } from './stats';

interface ThingWithName {
    from?: string;
    winner?: string;
}

export default class RemotePlayer implements Player {

    readonly human = true;

    private socket: Socket;

    private rules?: Rules;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    get id(): string {
        return this.socket.userId;
    }

    get name(): string {
        return this.socket.name;
    }

    get connected(): boolean {
        return this.socket.isOpen;
    }

    /**
     * This player may have reconnected with a different socket, so we
     * update our socket and replay the old one's outstanding messages
     * on the new one.
     */

    async reset(socket: Socket) {
        if (this.socket === socket) {
            return;
        }
        const old = this.socket;
        this.socket = socket;
        await old.replay(socket);
    }

    private you<T extends ThingWithName>(msg: T): T {
        // if (msg.winner === this.name) {
        //     msg.winner = 'you';
        // }
        // if (msg.from === this.name) {
        //     msg.from = 'you';
        // }
        return msg;
    }

    startingGame(msg: { table: string[], rules: Rules, desc: string[] }): void {
        this.rules = msg.rules;
        this.socket.send('startingGame', msg);
    }

    startingHand(): Promise<void> {
        return this.socket.send('startingHand', null, 'readyToStartHand')
            .then(() => undefined);
    }

    draw(msg: { bones: Bone[] }): void {
        this.socket.send('draw', msg);
    }

    waitingForBid(msg: { from: string}): void {
        this.socket.send('waitingForBid', this.you(msg));
    }

    async bid(msg: { possible: Bid[] }): Promise<Bid> {
        const start = Date.now();
        return this.socket.send('bid', msg, 'submitBid')
            .then((reply) => {
                assert(reply);
                writeStat('bid', this.id, Date.now() - start);
                return reply.bid;
            });
    }

    bidSubmitted(msg: { from: string, bid: Bid }): void {
        this.socket.send('bidSubmitted', this.you(msg));
    }

    reshuffle(): void {
        this.socket.send('reshuffle', null);
    }

    bidWon(msg: { from: string, bid: Bid }): void {
        this.socket.send('bidWon', this.you(msg));
    }

    waitingForTrump(msg: { from: string }): void {
        this.socket.send('waitingForTrump', msg);
    }

    async call(msg: { possible: Trump[] }): Promise<Trump> {
        const start = Date.now();
        return this.socket.send('call', msg, 'callTrump')
            .then((reply) => {
                assert(reply);
                writeStat('call', this.id, Date.now() - start);
                return reply.trump;
            });
    }

    trumpSubmitted(msg: { from: string, trump: Trump; }): void {
        this.socket.send('trumpSubmitted', this.you(msg));
    }

    waitingForPlay(msg: { from: string }): void {
        this.socket.send('waitingForPlay', this.you(msg));
    }

    async play(msg: { possible: Bone[], all: Bone[] }): Promise<Bone> {
        const start = Date.now();
        if (this.rules?.renege) {
            msg.possible = msg.all;
        }
        return this.socket.send('play', msg, 'playBone')
            .then((reply) => {
                assert(reply);
                writeStat('play', this.id, Date.now() - start);
                return reply.bone;
            });
    }

    playSubmitted(msg: { from: string, bone: Bone }): void {
        this.socket.send('playSubmitted', this.you(msg));
    }

    async endOfTrick(msg: { winner: string, points: number, status: Status }): Promise<void> {
        return this.socket.send('endOfTrick', this.you(msg),
            'readyToContinue').then(() => undefined);
    }

    async endOfHand(msg: { winner: Team, made: boolean, status: Status}): Promise<void> {
        return this.socket.send('endOfHand', this.you(msg),
            'readyToContinue').then(() => undefined);
    }

    gameOver(msg: { status: Status }): void {
        this.socket.send('gameOver', msg);
    }

    gameError(msg: GameError): void {
        this.socket.send('gameError', msg);
    }

    gameIdle(msg: GameIdle): void {
        this.socket.send('gameIdle', msg, 'readyToContinue');
    }
}
