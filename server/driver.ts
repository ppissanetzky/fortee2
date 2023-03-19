import assert from 'node:assert';

import Rules from './core/rules';
import Bid from './core/bid';
import Bone from './core/bone';
import Trump from './core/trump';
import Game, { PlayResult, STEP } from './core/game';

export { Rules, Bid, Bone, Trump, Game, PlayResult };

export interface PlayerAdapter {

    readonly name: string;

    /**
     * A new hand is about to start, just notifies all the players
     * and it actually starts when they reply.
     */

    startingHand(): Promise<void>;

    /**
     * Tells each player the bones they drew once the hand starts
     * or after a reshuffle
     */

    draw(bones: Bone[]): void;

    /**
     * Waiting on someone else to bid, doesn't require ack
     */

    waitingForBid(from: string): void;

    /**
     * Wait for this player to bid, one the possible bids
     */

    bid(possible: Bid[]): Promise<Bid>;

    /**
     * A player has bid
     */

    bidSubmitted(from: string, bid: Bid): void;

    /**
     * Everyone passed, so we are going to reshuffle
     */

    reshuffle(): void;

    /**
     * A player has won the bid
     */

    bidWon(winner: string, bid: Bid): void;

    /**
     * Waiting for someone else to call trumps
     */

    waitingForTrump(from: string): void;

    /**
     * This player calls trumps
     */

    call(possible: Trump[]): Promise<Trump>;

    /**
     * A player called trumps
     */

    trumpSubmitted(from: string, trump: Trump): void;

    /**
     * Waiting for someone else to play
     */

    waitingForPlay(from: string): void;

    /**
     * This player plays a bone
     */

    play(possible: Bone[]): Promise<Bone>;

    /**
     * Someone played a bone
     */

    playSubmitted(from: string, bone: Bone): void;

    /**
     * A trick is over
     */

    endOfTrick(result: PlayResult): void;

    /**
     * A hand is over. Will arrive right after endOfTrick
     */

    endOfHand(result: PlayResult): void;

    /**
     * The game is over, will arrive right after endOfHand
     */

    gameOver(): void;
}

type Callback = (adapter: PlayerAdapter) => void;

export default class GameDriver {

    /**
     * Starts a new game and resolves when the game is over.
     *
     * @param rules
     * @param adapters
     * @returns
     */

    static async start(rules: Rules, adapters: PlayerAdapter[]): Promise<void> {
        const driver = new GameDriver(rules, adapters);
        return driver.next();
    }

    private readonly adapters: PlayerAdapter[];
    private readonly game: Game;

    private constructor(rules: Rules, adapters: PlayerAdapter[]) {
        assert(adapters.length === 4, 'Too few adapters');
        this.adapters = adapters;
        this.game = new Game(adapters.map(({name}) => name), rules);
    }

    private all(cb: Callback): void {
        this.adapters.forEach(cb);
    }

    private not(name: string, cb: Callback): void {
        const result = this.adapters.filter((adapter) => adapter.name !== name);
        assert(result.length === 3, 'Not has wrong count');
        result.forEach(cb);
    }

    private just(name: string): PlayerAdapter {
        const result = this.adapters.find((adapter) => adapter.name === name);
        assert(result, `Player ${name} not found`);
        return result;
    }

    private index(name: string): number {
        const result = this.adapters.findIndex((adapter) => adapter.name === name);
        assert(result >= 0 && result <= 3, `Player ${name} not found`);
        return result;
    }

    private bones(name: string): Bone[] {
        return this.game.this_hand.bones_left[this.index(name)];
    }

    private async next(): Promise<void> {
        switch (this.game.next_step) {
            case STEP.START_HAND: {
                    await Promise.all(this.adapters.map((adapter) => adapter.startingHand()));
                    this.game.start_hand();
                    this.all((adapter) => adapter.draw(this.bones(adapter.name)));
                }
                break;
            case STEP.BID: {
                    const [target, bids] = this.game.get_next_bidder();
                    this.not(target, (adapter) => adapter.waitingForBid(target));
                    const bid = await this.just(target).bid(bids);
                    const result = this.game.player_bid(target, bid);
                    this.not(target, (adapter) => adapter.bidSubmitted(target, bid));
                    if (result === 'BID_RESHUFFLE') {
                        this.all((adapter) => adapter.reshuffle());
                        this.all((adapter) =>
                            adapter.draw(this.bones(adapter.name)));
                    }
                    else if (result === 'BID_DONE') {
                        const index = this.game.this_hand.high_bidder;
                        const bid = this.game.this_hand.high_bid;
                        this.all((adapter) =>
                            adapter.bidWon(this.adapters[index].name, bid));
                    }
                }
                break;
            case STEP.TRUMP: {
                    const [target , trumps] = this.game.get_trump_caller();
                    this.not(target, (adapter) => adapter.waitingForTrump(target));
                    const trump = await this.just(target).call(trumps);
                    this.game.player_trump(target, trump);
                    this.all((adapter) => adapter.trumpSubmitted(target, trump));
                }
                break;
            case STEP.PLAY: {
                    const [target , bones] = this.game.get_next_player();
                    this.not(target, (adapter) => adapter.waitingForPlay(target));
                    const bone = await this.just(target).play(bones);
                    this.all((adapter) => adapter.playSubmitted(target, bone));
                    const result = this.game.player_play(target, bone);
                    if (result.trick_over) {
                        this.all((adapter) => adapter.endOfTrick(result));
                    }
                    if (result.hand_over) {
                        if (result.early_finish) {
                            // TODO: Here we could skip calling finish hand, which
                            // would take us to EARLY_FINISH
                        }
                        this.all((adapter) => adapter.endOfHand(result));
                        this.game.finish_hand(result);
                    }
                }
                break;
            case STEP.EARLY_FINISH: {
                    assert(false, 'Should not get early finish');
                    this.game.play_it_out(true);
                }
                break;
            case STEP.GAME_OVER: {
                    this.all((adapter) => adapter.gameOver());
                    // TODO: What else can we do here?
                    return;
                }
            default:
                assert(false, 'Invalid step');
        }
        return this.next();
    }
}
