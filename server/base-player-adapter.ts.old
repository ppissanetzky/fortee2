import assert from 'node:assert';
import _ from 'lodash';
import prompts from 'prompts';

import { Bid, Bone, Trump, Status, PlayerAdapter, Team } from './driver';

import BoneSet from './bone-set';

export default class BasePlayerAdapter implements PlayerAdapter {

    public readonly name: string;

    private readonly log: (...args: any[]) => void;
    private readonly random: boolean;
    private bones = new BoneSet();

    constructor(name: string, silent = false, random = false) {
        this.name = name;
        this.random = random;
        this.log = silent
            ? () => undefined
            : (...args: any[]) => console.log(...args);
    }

    private async prompt(message: string, choices: (Bid | Trump | Bone)[]): Promise<string> {
        const strings = choices.map((thing) => thing.toString());
        if (this.random) {
            const result = _.sample(strings);
            assert(result, `Nothing to pick from`);
            return result;
        }
        const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: `Player ${this.name} : ${message}`,
            choices: strings.map((title) => ({title, value: title}))
        });
        if (!choice) {
            return process.exit(0);
        }
        return choice;
    }

    private showBones() {
        this.log('You have', this.bones.ids().join('  '));
    }

    startingHand(): Promise<void> {
        return Promise.resolve();
    }

    draw(bones: Bone[]) {
        assert(bones.length === 7, `Drew ${bones.length}`);
        assert(this.bones.size === 0, `Drew when not empty`);
        this.bones.set(bones);
        this.showBones();
    }

    waitingForBid(/* from: string */): void { void 0 }

    async bid(possible: Bid[]): Promise<Bid> {
        this.showBones();
        if (this.random) {
            // This is just to make the random players more
            // conservative in their bids
            //
            // Pass
            if (possible.includes(Bid.PASS) && _.random(100) < 90) {
                return Bid.PASS;
            }
            // The lowest possible bid after pass
            return possible[0];
            //bids = possible.filter(({points}) => points < 42);
        }
        const choice = await this.prompt('your bid', possible);
        return Bid.find(choice);
    }

    bidSubmitted(from: string, bid: Bid): void {
        this.log('Player', from, 'bid', bid.toString());
    }

    reshuffle(): void {
        this.log('Reshuffle');
        this.bones.clear();
    }

    bidWon(winner: string, bid: Bid): void {
        this.log('Player', winner, 'won the bid with', bid.toString());
    }

    waitingForTrump(/* from: string */): void { void 0 }

    async call(possible: Trump[]): Promise<Trump> {
        this.showBones();
        const choice = await this.prompt('call trumps', possible);
        return Trump.find(choice);
    }

    trumpSubmitted(from: string, trump: Trump): void {
        this.log('Player', from, 'called trumps', trump.toString());
    }

    waitingForPlay(/* from: string */): void { void 0 }

    async play(possible: Bone[]): Promise<Bone> {
        this.showBones();
        const choice = await this.prompt('play', possible);
        const bone = this.bones.delete(choice);
        return bone;
    }

    playSubmitted(from: string, bone: Bone): void {
        this.log('Player', from, 'played the', bone.toString());
    }

    endOfTrick(winner: string, points: number, status: Status): void {
        this.log('Player', winner,
            'won the trick with', points, `point${points === 1 ? '' : 's'}`);
        this.log('US', status.US.points, 'THEM', status.THEM.points);
    }

    endOfHand(winner: Team, made: boolean, status: Status): void {
        this.bones.clear();
        this.log('');
        this.log('Hand over');
        this.log(winner, made ? 'made the bid' : 'set');
        this.log('US', status.US.marks, 'marks',
            ':', 'THEM', status.THEM.marks, 'marks');
    }

    gameOver(status: Status): void {
        this.log('Game over');
        this.log(status);
    }
}
