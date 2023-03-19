
import prompts from 'prompts';

import Rules from './core/rules';
import Bid from './core/bid';
import Bone from './core/bone';
import Trump from './core/trump';
import Game, { STEP } from './core/game';

const rules = new Rules();
const players = [ '1' , '2' , '3' , '4' ];
const host = 'A'

const game = new Game(players, rules);

function next(): Promise<void> {
    return Promise.resolve().then(() => {
        const [target , prompt , choices] = game.next_turn( host );

        const index = players.indexOf(target);

        if (prompt === STEP.START_HAND) {
            console.log('Starting hand');
            game.start_hand();
            return next();
        }

        if(prompt === STEP.GAME_OVER) {
            console.log('Game over');
            return;
        }

        console.log('');
        console.log('YOU HAVE:',
            game.this_hand.bones_left[index]
                .map((bone) => bone.toString()).join('  '));

        choices.push('quit');

        return prompts({
            type: 'select',
            name: 'choice',
            message: `PLAYER ${target} : ${prompt}`,
            choices: choices.map((title) => ({title, value: title}))
        })
        .then(({choice}) => {
            if (choice === 'quit' || !choice) {
                return process.exit(0);
            }
            switch (prompt) {
                case STEP.BID:
                    game.player_bid(target, Bid.find(choice));
                    return next();
                case STEP.TRUMP:
                    game.player_trump(target, Trump.find(choice));
                    return next();
                case STEP.PLAY:
                    {
                        const play_result = game.player_play(target, Bone.find( choice ) );
                        if (play_result.trick_over) {
                            console.log('TRICK OVER');
                            console.log(players[play_result.trick_winner], 'WON', play_result.trick_points, 'POINTS');
                            console.log(game.this_hand.points);
                            if (play_result.hand_over) {
                                console.log('');
                                console.log('HAND OVER');
                                console.log(play_result.winning_team , 'WON');
                                game.finish_hand( play_result );
                                console.log('US', game.marks.US, ':' , 'THEM', game.marks.THEM);
                            }
                        }
                    }
                    return next();
                case STEP.EARLY_FINISH:
                    if (choice.toUpperCase() === 'YES') {
                        return;
                    }
                    game.play_it_out(true);
                    return next();
            }
        });
    });
}

next().then(() => undefined);

