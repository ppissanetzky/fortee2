
import { Rules } from './core';
import GameDriver from './driver';
import { RandomPlayer } from './player';
import { PassBot } from './random-bot';
import PromptPlayer from './prompt-player';

const auto = process.argv[2] === 'auto';
let count = parseInt(process.argv[3] || '1', 10);

class ChattyPlayer extends RandomPlayer {
    protected debug(...args: any[]): void {
        console.log(...args);
    }
}

function play(): Promise<void> {

    const rules = new Rules();

    const me = new PromptPlayer();

    const players = [
        me,
        new PassBot(),
        new PassBot(),
        new PassBot(),
    ];

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
