
import assert from 'node:assert';
import _ from 'lodash';
import prompts from 'prompts';

import GameDriver, {
    Bid, Bone, Rules, Status,
    Trump, PlayerAdapter, Team } from './driver';

import BoneSet from './bone-set';

interface ToString {
    toString(): string;
}

function toStringArray<T extends ToString>(things: T[]): string [] {
    return things.map((thing) => thing.toString());
}

class PromptAdapter implements PlayerAdapter {

    public readonly name: string;

    private readonly silent: boolean;
    private readonly random: boolean;
    private bones = new BoneSet();

    constructor(name: string, silent = false, random = false) {
        this.name = name;
        this.silent = silent;
        this.random = random;
    }

    private async prompt(message: string, choices: ToString[]): Promise<string> {
        const strings = toStringArray(choices);
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
        if (choice === 'quit' || !choice) {
            return process.exit(0);
        }
        return choice;
    }

    private showBones() {
        if (!this.silent) {
            console.log('You have', this.bones.ids().join('  '));
        }
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
            if (_.random(100) < 90) {
                return Bid.PASS;
            }
            // The lowest possible bid after pass
            return possible[1];
            //bids = possible.filter(({points}) => points < 42);
        }
        const choice = await this.prompt('your bid', possible);
        return Bid.find(choice);
    }

    bidSubmitted(from: string, bid: Bid): void {
        if (!this.silent) {
            console.log('Player', from, 'bid', bid.toString());
        }
    }

    reshuffle(): void {
        if (!this.silent) {
            console.log('Reshuffle');
        }
        this.bones.clear();
    }

    bidWon(winner: string, bid: Bid): void {
        if (!this.silent) {
            console.log('Player', winner, 'won the bid with', bid.toString());
        }
    }

    waitingForTrump(/* from: string */): void { void 0 }

    async call(possible: Trump[]): Promise<Trump> {
        this.showBones();
        const choice = await this.prompt('call trumps', possible);
        return Trump.find(choice);
    }

    trumpSubmitted(from: string, trump: Trump): void {
        if (!this.silent) {
            console.log('Player', from, 'called trumps', trump.toString());
        }
    }

    waitingForPlay(/* from: string */): void { void 0 }

    async play(possible: Bone[]): Promise<Bone> {
        this.showBones();
        const choice = await this.prompt('play', possible);
        const bone = this.bones.delete(choice);
        return bone;
    }

    playSubmitted(from: string, bone: Bone): void {
        if (!this.silent) {
            console.log('Player', from, 'played the', bone.toString());
        }
    }

    endOfTrick(winner: string, points: number, status: Status): void {
        if (!this.silent) {
            console.log('Player', winner,
                'won the trick with', points, `point${points === 1 ? '' : 's'}`);
            console.log('US', status.US.points, 'THEM', status.THEM.points);
        }
    }

    endOfHand(winner: Team, made: boolean, status: Status): void {
        this.bones.clear();
        if (!this.silent) {
            console.log('');
            console.log('Hand over');
            console.log(winner, made ? 'made the bid' : 'set');
            console.log('US', status.US.marks, 'marks',
                ':', 'THEM', status.THEM.marks, 'marks');
        }
    }

    gameOver(status: Status): void {
        if (!this.silent) {
            console.log('Game over');
            console.log(status);
        }
    }
}

const auto = process.argv[2] === 'auto';
let count = parseInt(process.argv[3] || '1', 10);

function play(): Promise<void> {
    const players = [
        new PromptAdapter('1', auto && count > 0, auto),
        new PromptAdapter('2', true, true),
        new PromptAdapter('3', true, true),
        new PromptAdapter('4', true, true),
    ];

    const rules = new Rules();

    return GameDriver.start(rules, players).then(() => {
        if (!auto) {
            console.log('\nDONE');
        }
        else if (count--) {
            console.log(count);
            return play();
        }
    });
}

play();
