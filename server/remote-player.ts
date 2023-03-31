import assert from 'node:assert';

import type Player from './player';
import type { Bid , Bone, Team, Trump } from './core';
import type { Status } from './driver';
import Socket from './socket';

interface ThingWithName {
    from?: string;
    winner?: string;
}

export default class RemotePlayer implements Player {

    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    get name(): string {
        return this.socket.name;
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

    startingGame(msg: { table: string[]}): void {
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
        return this.socket.send('bid', msg, 'submitBid')
            .then((reply) => {
                assert(reply);
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
        return this.socket.send('call', msg, 'callTrump')
            .then((reply) => {
                assert(reply);
                return reply.trump;
            });
    }

    trumpSubmitted(msg: { from: string, trump: Trump; }): void {
        this.socket.send('trumpSubmitted', this.you(msg));
    }

    waitingForPlay(msg: { from: string }): void {
        this.socket.send('waitingForPlay', this.you(msg));
    }

    async play(msg: { possible: Bone[] }): Promise<Bone> {
        return this.socket.send('play', msg, 'playBone')
            .then((reply) => {
                assert(reply);
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

}
