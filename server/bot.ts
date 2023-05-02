import _ from 'lodash';
import type { YourBid, YourCall, YourPlay } from './outgoing-messages';
import type { Bid, Trump, Bone } from './core';
import { BasePlayer } from './base-player';
import getNextBotName from './bot-names';

/**
 * A player that can have a delay and will play randomly unless
 * it is given some strategies
 */

export default class Bot extends BasePlayer {

    private readonly fastAF: boolean;

    private async delay(): Promise<void> {
        if (!this.fastAF) {
            return new Promise<void>((resolve) => {
                setTimeout(resolve, _.random(500, 2000));
            });
        }
    }

    constructor(name = getNextBotName(), fastAF = false) {
        super(`:bot:${name}`, name);
        this.fastAF = fastAF;
    }

    override async startingHand(): Promise<void> {
        await this.delay();
        return super.startingHand();
    }

    override async bid(msg: YourBid): Promise<Bid> {
        await this.delay();
        return super.bid(msg);
    }

    override async call(msg: YourCall): Promise<Trump> {
        await this.delay();
        return super.call(msg);
    }

    override async play(msg: YourPlay): Promise<Bone> {
        await this.delay();
        return super.play(msg);
    }
}

