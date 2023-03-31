import prompts from 'prompts';

import { Bid , Bone, Trump } from './core';
import { BasePlayer } from './base-player';
import type { BidSubmitted, EndOfHand, EndOfTrick, GameOver, PlaySubmitted, StartingGame, TrumpSubmitted } from './outgoing-messages';

export default class PromptPlayer extends BasePlayer {

    constructor() {
        super('you');
        this.with({
            name: 'prompt',
            bid: async (player, possible) => {
                console.log('You have', Bone.toList(player.bones).join(' '));
                return Bid.find(await this.choose('Your bid', possible));
            },
            call: async (player, possible) => {
                console.log('You have', Bone.toList(player.bones).join(' '));
                return Trump.find(await this.choose('Call trumps', possible));
            },
            play: async (player, possible) => {
                return Bone.find(await this.choose('Your turn', possible));
            }
        })
    }

    protected debug(...args: any[]): void {
        console.log(...args);
    }

    protected async choose(message: string, choices: (Bid | Bone | Trump)[]): Promise<string> {
        const strings = choices.map((choice) => choice.toString());
        const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message,
            choices: strings.map((title) => ({title, value: title}))
        });
        if (!choice) {
            return process.exit(0);
        }
        return choice;
    }

    startingGame(msg: StartingGame) {
        super.startingGame(msg);
        console.log('Your partner is', this.table?.partner);
    }

    bidSubmitted(msg: BidSubmitted): void {
        super.bidSubmitted(msg);
        console.log(msg.from, 'bid', msg.bid.toString());
    }

    bidWon(msg: BidSubmitted): void {
        super.bidWon(msg);
        console.log(msg.from, 'wond the bid with', msg.bid.toString());
    }

    trumpSubmitted(msg: TrumpSubmitted): void {
        super.trumpSubmitted(msg);
        console.log('Trumps are', msg.trump.toString());
    }

    playSubmitted(msg: PlaySubmitted): void {
        super.playSubmitted(msg);
        console.log(msg.from, 'played the', msg.bone.toString());
    }

    async endOfTrick(msg: EndOfTrick): Promise<void> {
        await super.endOfTrick(msg);
        console.log(msg.winner, 'won the trick with', msg.points);
        console.log('US', msg.status.US.points, 'THEM', msg.status.THEM.points);
    }

    async endOfHand(msg: EndOfHand): Promise<void> {
        await super.endOfHand(msg);
        console.log(msg.winner, 'won the hand');
        console.log('US', msg.status.US.marks, 'THEM', msg.status.THEM.marks);
    }

    gameOver(msg: GameOver): void {
        console.log('Game over');
        super.gameOver(msg);
        process.exit(0);
    }
}
