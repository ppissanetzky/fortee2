
import { Rules, Bone } from './core';
import GameDriver from './driver';
import { RandomPlayer } from './player';
import { PassBot, DebugBot} from './random-bot';
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
        new PassBot(true),
        new DebugBot(),
        new PassBot(true),
    ];

    const fixed = new Map<number, Bone[]>([
        [0, Bone.list(['3.0', '2.1', '0.0', '1.0', '6.0', '5.2', '4.1'])],
        [2, Bone.list(['4.4', '6.4', '3.3', '3.1', '5.5', '1.1', '5.1'])]
    ]);

    return GameDriver.start(rules, players, fixed).then(() => {
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
