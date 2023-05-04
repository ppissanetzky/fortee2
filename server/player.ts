
import type {
    EndOfHand, EndOfTrick, GameMessages, YourBid, YourCall, YourPlay
} from './outgoing-messages';

import { Bid , Bone, Trump } from './core';

type Result = void | Bid | Trump | Bone;

type PlayerHandler = {
    [K in keyof GameMessages]:
        (msg: GameMessages[K]) => void | Promise<Result>;
}

export default interface Player extends PlayerHandler {

    readonly name: string;
    readonly id: string;
    readonly connected: boolean;

    readonly human: boolean;

    /**
     * These are the ones that return something
     */

    startingHand(): Promise<void>;

    bid(msg: YourBid): Promise<Bid>;

    call(msg: YourCall): Promise<Trump>;

    play(msg: YourPlay): Promise<Bone>;

    endOfTrick(msg: EndOfTrick): Promise<void>;

    endOfHand(msg: EndOfHand): Promise<void>;
}
