import assert from 'assert';
import _ from 'lodash';

import type { GameMessages } from './outgoing-messages';
import { Bid , Bone, Game, Team, Trump } from './core';
import type { Status } from './driver';

type Result = void | Bid | Trump | Bone;

type PlayerHandler = {
    [K in keyof GameMessages]:
        (msg: GameMessages[K]) => void | Promise<Result>;
}

export default interface Player extends PlayerHandler {

    readonly name: string;

    /**
     * These are the ones that return something
     */

    startingHand(): Promise<void>;

    bid(msg: GameMessages['bid']): Promise<Bid>;

    call(msg: GameMessages['call']): Promise<Trump>;

    play(msg: GameMessages['play']): Promise<Bone>;

    endOfTrick(msg: GameMessages['endOfTrick']): Promise<void>;

    endOfHand(msg: GameMessages['endOfHand']): Promise<void>;
}

export class RandomPlayer implements Player {

    public readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    protected debug(...args: any[]): void { void 0 }

    protected choose(message: string, choices: (Bid | Bone | Trump)[]): Promise<string> {
        const result = _.sample(choices.map((choice) => choice.toString()));
        assert(result, 'No possible choice');
        return Promise.resolve(result);
    }

    startingHand(): Promise<void> {
        this.debug('starting hand');
        return Promise.resolve();
    }

    draw({ bones } : { bones: Bone[] }): void {
        this.debug('drew', bones.map((bone) => bone.toString()));
    }

    waitingForBid({ from } : { from: string}): void {
        this.debug('waiting for bid from', from);
    }

    async bid({ possible } : { possible: Bid[] }): Promise<Bid> {
        const bid = await this.choose('bid', possible);
        this.debug('bid', bid);
        return Bid.find(bid);
    }

    bidSubmitted({ from, bid } : { from: string, bid: Bid }): void {
        this.debug(from, 'bid', bid.toString());
    }

    reshuffle(): void {
        this.debug('reshuffle');
    }

    bidWon({ winner, bid } : { winner: string, bid: Bid }): void {
        this.debug(winner, 'won the bid with', bid.toString());
    }

    waitingForTrump({ from } : { from: string }): void {
        this.debug('waiting for', from, 'to call trumps');
    }

    async call({ possible } : { possible: Trump[] }): Promise<Trump> {
        const trump = await this.choose('trump', possible);
        this.debug('called trumps', trump);
        return Trump.find(trump);
    }

    trumpSubmitted({ from, trump } : { from: string, trump: Trump; }): void {
        this.debug(from, 'called trumps as', trump.toString());
    }

    waitingForPlay({ from } : { from: string }): void {
        this.debug('waiting for', from, 'to play');
    }

    async play({ possible } : { possible: Bone[] }): Promise<Bone> {
        const bone = await this.choose('play', possible);
        this.debug('played', bone);
        return Bone.find(bone);
    }

    playSubmitted({ from, bone } : { from: string, bone: Bone }): void {
        this.debug(from, 'played the', bone.toString());
    }

    async endOfTrick({ winner, points, status } : { winner: string, points: number, status: Status }): Promise<void> {
        this.debug(winner,
            'won the trick with', points, `point${points === 1 ? '' : 's'}`);
        this.debug('US', status.US.points, 'THEM', status.THEM.points);
    }

    async endOfHand({ winner, made, status } : { winner: Team, made: boolean, status: Status}): Promise<void> {
        this.debug('hand over');
        this.debug(winner, made ? 'made the bid' : 'set');
        this.debug('US', status.US.marks, 'marks',
            ':', 'THEM', status.THEM.marks, 'marks');
    }

    gameOver({ status } : { status: Status }): void {
        this.debug('game over');
        this.debug(status);
    }
}
