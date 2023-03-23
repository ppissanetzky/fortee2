import { Bid } from './core';
import { RandomPlayer } from './player';
import getNextBotName from './bot-names';

export default class RandomBot extends RandomPlayer {

    constructor() {
        super(getNextBotName());
    }
}

export class PassBot extends RandomBot {

    async bid({ possible } : { possible: Bid[] }): Promise<Bid> {
        const [lowest] = possible;
        return lowest;
//        return super.bid({possible: [lowest]});
    }

}
