import assert from 'node:assert';

import type Player from './player';
import type { Bid , Bone, Team, Trump } from './core';
import type { Status } from './driver';
import User from './user';

export default class RemotePlayer implements Player {

    private readonly user: User;

    constructor(user: User) {
        this.user = user;
    }

    get name(): string {
        return this.user.name;
    }

    startingHand(): Promise<void> {
        return this.user.send('startingHand', null, 'readyToStartHand')
            .then(() => undefined);
    }

    draw(msg: { bones: Bone[] }): void {
        this.user.send('draw', msg);
    }

    waitingForBid(msg: { from: string}): void {
        this.user.send('waitingForBid', msg);
    }

    async bid(msg: { possible: Bid[] }): Promise<Bid> {
        return this.user.send('bid', msg, 'submitBid')
            .then((reply) => {
                assert(reply);
                return reply.bid;
            });
    }

    bidSubmitted(msg: { from: string, bid: Bid }): void {
        this.user.send('bidSubmitted', msg);
    }

    reshuffle(): void {
        this.user.send('reshuffle', null);
    }

    bidWon(msg: { winner: string, bid: Bid }): void {
        this.user.send('bidWon', msg);
    }

    waitingForTrump(msg: { from: string }): void {
        this.user.send('waitingForTrump', msg);
    }

    async call(msg: { possible: Trump[] }): Promise<Trump> {
        return this.user.send('call', msg, 'callTrump')
            .then((reply) => {
                assert(reply);
                return reply.trump;
            });
    }

    trumpSubmitted(msg: { from: string, trump: Trump; }): void {
        this.user.send('trumpSubmitted', msg);
    }

    waitingForPlay(msg: { from: string }): void {
        this.user.send('waitingForPlay', msg);
    }

    async play(msg: { possible: Bone[] }): Promise<Bone> {
        return this.user.send('play', msg, 'playBone')
            .then((reply) => {
                assert(reply);
                return reply.bone;
            });
    }

    playSubmitted(msg: { from: string, bone: Bone }): void {
        this.user.send('playSubmitted', msg);
    }

    endOfTrick(msg: { winner: string, points: number, status: Status }): void {
        this.user.send('endOfTrick', msg);
    }

    endOfHand(msg: { winner: Team, made: boolean, status: Status}): void {
        this.user.send('endOfHand', msg);
    }

    gameOver(msg: { status: Status }): void {
        this.user.send('gameOver', msg);
    }

}
