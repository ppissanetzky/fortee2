
import { Rules } from './core';
import GameDriver from './driver';
import BasePlayerAdapter from './base-player-adapter';

const auto = process.argv[2] === 'auto';
let count = parseInt(process.argv[3] || '1', 10);

function play(): Promise<void> {
    const players = [
        new BasePlayerAdapter('1', auto && count > 0, auto),
        new BasePlayerAdapter('2', true, true),
        new BasePlayerAdapter('3', true, true),
        new BasePlayerAdapter('4', true, true),
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
