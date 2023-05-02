import type Player from './player';
import type { Bid , Bone, Trump, Rules } from './core';
import type {
    BidSubmitted, Draw, EndOfHand, EndOfTrick, GameError, GameIdle, GameOver,
    PlaySubmitted, StartingGame, TrumpSubmitted,
    YourBid, YourCall, YourPlay } from './outgoing-messages';

import Strategy, { Strategies } from './strategy';
import TableHelper from './table-helper';

export class BasePlayer implements Player {

    readonly human = false;

    protected readonly strategies: Strategies = new Strategies();

    public readonly name: string;
    public readonly id: string;

    public rules?: Rules;
    public table?: TableHelper;
    public bones: Bone[] = [];
    public bids: BidSubmitted[] = [];
    public winningBid?: BidSubmitted;
    public trump?: Trump;
    public trick: PlaySubmitted[] = [];
    public pile: PlaySubmitted[][] = [];

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    /** Adds strategies */

    with(...strategies: Strategy[]): this {
        this.strategies.add(...strategies);
        return this;
    }

    // #region Player protocol

    startingGame({ table, rules } : StartingGame ): void {
        this.rules = rules;
        this.table = new TableHelper(this.name, table);
    }

    async startingHand(): Promise<void> {
        this.bones = [];
        this.bids = [];
        this.winningBid = undefined;
        this.trump = undefined;
        this.trick = [];
        this.pile = [];
    }

    draw({ bones } : Draw): void {
        this.bones = bones;
    }

    waitingForBid(): void { void 0 }

    async bid({ possible } : YourBid): Promise<Bid> {
        return this.strategies.bid(this, possible);
    }

    bidSubmitted(msg : BidSubmitted): void {
        this.bids.push(msg);
    }

    reshuffle(): void {
        this.bones = [];
        this.bids = [];
    }

    bidWon(msg : BidSubmitted): void {
        this.winningBid = msg;
    }

    waitingForTrump(): void { void 0 }

    async call({ possible } : YourCall): Promise<Trump> {
        return this.strategies.call(this, possible);
    }

    trumpSubmitted({ trump } : TrumpSubmitted): void {
        this.trump = trump;
    }

    waitingForPlay(): void { void 0}

    async play({ possible } : YourPlay): Promise<Bone> {
        return this.strategies.play(this, possible);
    }

    playSubmitted(msg : PlaySubmitted): void {
        this.trick.push(msg);
    }

    async endOfTrick(msg: EndOfTrick): Promise<void> {
        msg;
        this.pile.push(this.trick);
        this.trick = [];
    }

    async endOfHand(msg: EndOfHand): Promise<void> {
        msg;
    }

    gameOver(msg: GameOver): void {
        msg;
    }

    gameError(msg: GameError): void {
        msg;
    }

    gameIdle(msg: GameIdle): void {
        msg;
    }

    // #endregion
}
