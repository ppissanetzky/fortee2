import assert from 'node:assert';

import Rules from './core/rules';
import Bid from './core/bid';
import Bone from './core/bone';
import Trump from './core/trump';
import Game, { STEP, Team } from './core/game';

export { Rules, Bid, Bone, Trump, Game, Team };

class TeamStatus {
    readonly players: string[] = [];
    /**
     * Points and pile for the current hand
     */
    readonly points: number = 0;
    // TODO
    readonly pile: Bone[][] = [];
    /**
     * Marks won so far
     */
    readonly marks: number = 0;

    constructor(game: Game, team: Team) {
        for (const [index, player] of game.players.entries()) {
            if (Game.team_for_player(index) === team) {
                this.players.push(player);
            }
        }
        const hand = game.this_hand;
        this.points = hand.points[team];
        this.pile = hand.pile;
        this.marks = game.marks[team];
    }
}

export class Status {

    public readonly US: TeamStatus;
    public readonly THEM: TeamStatus;

    public readonly bid: Bid;
    public readonly trump: Trump | undefined;

    constructor(game: Game) {
        this.US = new TeamStatus(game, 'US');
        this.THEM = new TeamStatus(game, 'THEM');

        const hand = game.this_hand;
        this.bid = hand.high_bid;
        this.trump = hand.trump;
    }
}

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

    endOfTrick(winner: string, points: number, status: Status): void;

    /**
     * A hand is over. Will arrive right after endOfTrick
     */

    endOfHand(winner: Team, made: boolean, status: Status): void;

    /**
     * The game is over, will arrive right after endOfHand
     */

    gameOver(status: Status): void;
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
                        const winner = this.game.players[result.trick_winner];
                        const points = result.trick_points;
                        this.all((adapter) =>
                            adapter.endOfTrick(winner, points, new Status(this.game)));
                    }
                    if (result.hand_over) {
                        if (result.early_finish) {
                            // TODO: Here we could skip calling finish hand, which
                            // would take us to EARLY_FINISH
                        }
                        const winner = result.winning_team;
                        assert(winner, 'Missing winner');
                        const made = result.bid_made;
                        this.game.finish_hand(result);
                        this.all((adapter) =>
                            adapter.endOfHand(winner, made, new Status(this.game)));
                    }
                }
                break;
            case STEP.EARLY_FINISH: {
                    assert(false, 'Should not get early finish');
                    this.game.play_it_out(true);
                }
                break;
            case STEP.GAME_OVER: {
                    const status = new Status(this.game);
                    this.all((adapter) => adapter.gameOver(status));
                    // TODO: What else can we do here?
                    return;
                }
            default:
                assert(false, 'Invalid step');
        }
        return this.next();
    }
}
