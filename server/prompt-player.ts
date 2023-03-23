import prompts from 'prompts';

import { Bid , Bone, Trump } from './core';
import { RandomPlayer } from './player';

export default class PromptPlayer extends RandomPlayer {

    constructor() {
        super('you');
    }

    protected debug(...args: any[]): void {
        console.log(...args);
    }

    protected async choose(message: string, choices: (Bid | Bone | Trump)[]): Promise<string> {
        const strings = choices.map((choice) => choice.toString());
        const { choice } = await prompts({
            type: 'select',
            name: 'choice',
            message: `Your ${message}`,
            choices: strings.map((title) => ({title, value: title}))
        });
        if (!choice) {
            return process.exit(0);
        }
        return choice;
    }
}
