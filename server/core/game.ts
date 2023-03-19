import assert from 'node:assert';

import _ from 'lodash';

import type Rules from './rules';
import Bid from './bid';
import Bone from './bone';
import Trump from './trump';

function loop(n: number, f: (i: number) => void) {
    for (let i = 0; i < n; i++) {
        f(i);
    }
}

type Player = string;

type Team = 'US' | 'THEM';

class Score {
    public US: number = 0;
    public THEM: number = 0;

    clear() {
        this.US = 0;
        this.THEM = 0;
    }
}

/**
 * These must be in increasing order
 * (NOT SURE WHY I MADE THAT COMMENT)
 */

export const enum STEP {
    START_HAND         = 'START_HAND',
    BID                = 'BID',
    TRUMP              = 'TRUMP',
    PLAY               = 'PLAY',
    EARLY_FINISH       = 'EARLY_FINISH',
    GAME_OVER          = 'GAME_OVER',
};

const BID_RESULT_AGAIN        = 'BID_AGAIN';
const BID_RESULT_DONE         = 'BID_DONE';
const BID_RESULT_RESHUFFLE    = 'BID_RESHUFFLE';

type BidResult = 'BID_AGAIN' | 'BID_DONE' | 'BID_RESHUFFLE';

class Trick {
    public trick_leader       = -1
    public trick_bones        : Bone[] = [];
    public trick_over         = false;
    public trick_winner       = -1;
    public trick_points       = 0;
    public points             = new Score();
}

class Hand {

    public pulled_bones       : Bone[][] = [];
    public bones_left         : Bone[][] = []
    public first_bidder       = -1;
    public points             = new Score();
    public bid_count          = 0;
    public bids               : Bid[] = [];
    public next_bidder        = -1;
    public high_bid           = Bid.PASS;
    public high_bidder        = -1
    public trump?             : Trump = undefined;
    public have_trump         = false;
    public partner_calls      = false;
    public bid_forced         = false;
    public hand_leader        = -1;
    public trick_leader       = -1;
    public next_player        = -1;
    public trick_bones        : Bone[] = [];
    public trick_count        = 0;
    public pile               : Bone[][] = [[], [], [], [], [], [], []];
    public points_reached     = false
    public tricks             : Trick[] = [];
    public hand_over          = false;
    public bid_made           = false;

    constructor(first_bidder: number) {
        this.first_bidder = first_bidder;
        this.next_bidder = first_bidder;
    }

    get this_trick() {
        return this.tricks.at(-1);
    }

    shake_and_pull() {
        const bones = Bone.pull();
        this.pulled_bones = [];
        this.bones_left = [];
        loop(4, (i) => {
            const start = i * 7;
            const pulled = bones.slice(start, start + 7);
            // An array of 4 arrays, each with 7 bones
            this.pulled_bones.push([...pulled]);
            this.bones_left.push([...pulled]);
        });
    }
}

class PlayResult {
    public trick_over     = false;
    public trick_winner   = -1;
    public trick_points   = 0;
    public hand_over      = false;
    public early_finish   = false;
    public bid_made       = false;
    public winning_team?  : Team;
    public game_over      = false;
}

export default class Game {

    public readonly rules: Rules;

    public players: Player[];

    public next_shaker    = -1;
    public marks          = new Score();
    public hands          : Hand [] = [];
    public next_step      = STEP.START_HAND;

    constructor(players: Player[] , rules: Rules) {
        this.players = [...players];
        this.rules = rules;
        this.new_game();
    }

    static partner_for(player: number): number {
        const partners = [2, 3, 0, 1];
        return partners[player];
    }

    static inc_player(player: number, amount: number = 1 ): number {
        let result = player;
        for (let left = amount; left; left--) {
            if (result === 3) {
                result = 0;
            }
            else {
                result += 1;
            }
        }
        return result;
    }

    static team_for_player(player: number): Team {
        if (player === 0 || player === 2) {
            return 'US';
        }
        return 'THEM';
    }

    static other_team(player: number): Team {
        return this.team_for_player(player) === 'US' ? 'THEM' : 'US';
    }

    get this_hand(): Hand {
        return this.hands.at(-1)!;
    }

    new_game() {
        this.next_shaker = _.random(0, 3);
        this.marks.clear();
        this.hands = [];
        this.next_step = STEP.START_HAND;
    }

    start_hand() {
        this.next_shaker = Game.inc_player(this.next_shaker);
        this.hands.push(new Hand(this.next_shaker));
        this.next_step = STEP.BID;
        this.shake_and_pull();
    }

    shake_and_pull() {
        this.this_hand.shake_and_pull();
    }

    reset_hand() {
        if (this.hands.length === 0) {
            this.start_hand();
            return;
        }

        const hand = this.this_hand;

        hand.next_bidder = hand.first_bidder;
        hand.bid_count = 0;
        hand.bids = [];
        hand.points.clear();
        hand.high_bid = Bid.PASS;
        hand.bid_forced = false;
        hand.partner_calls = false;
        hand.have_trump = false;
        hand.trick_count = 0;
        hand.points_reached = false;
        hand.tricks = [];
        hand.trick_bones = [];

        loop(4, (i) => {
            hand.bones_left[i] = [...hand.pulled_bones[i]];
        });
        this.next_step = STEP.BID;
    }

    /**
     *  Returns the information necessary to prompt the next bidder: the name of the
     *  next bidder and an array of the possible bids for that bidder.
     *
     *  Does not change internal state - it can be called multiple times with the same
     *  result.
     */

    get_next_bidder(): [Player, Bid[]] {
        const hand = this.this_hand;
        assert(hand.bid_count < 4, 'Calling next bidder when bidding is done');

        const player = this.players[hand.next_bidder];
        const possible_bids: Bid[] = [];
        const high_bid = hand.high_bid;
        let can_pass = true;
        let min_bid: Bid | undefined = Bid.PASS;

        // if the highest bid is pass, then we set the min bid according to the
        // rules. Otherwise, it is one higher than the high bid

        if (high_bid.is_pass) {
            if (hand.bid_count === 3) {
                // is last bidder and everyone else passed
                min_bid = Bid.find(this.rules.forced_min_bid);
                if (this.rules.all_pass === 'FORCE') {
                    can_pass = false;
                }
            }
            else {
                // Everyone else passed
                min_bid = Bid.find(this.rules.min_bid);
            }
        }
        else {
            // Otherwise, the bid is the next highest one from the high bid
            min_bid = high_bid.bid_one_more();
        }

        assert(min_bid);

        // Now add all bids that are higher than or equal to the min bid we selected
        // to the possible bids array

        if (can_pass) {
            possible_bids.push(Bid.PASS);
        }
        for (const bid of Bid.ALL) {
            if (!possible_bids.includes(bid)) {
                if (bid.order >= min_bid.order) {
                    if (min_bid.marks <= 1) {
                        if (bid.marks <= 2) {
                            possible_bids.push(bid);
                        }
                    }
                    else if (bid.marks === min_bid.marks) {
                        possible_bids.push(bid);
                    }
                }
            }
        }

        return [player, possible_bids];
    }

    // A player submits a bid.
    // Returns the result - bid again, bid done or reshuffle

    player_bid(player: Player, bid: Bid): BidResult {

        const [check_player, possible_bids] = this.get_next_bidder();

        assert(check_player === player, `Player bidding out of turn. Expecting ${check_player} but got ${player}`);
        assert(possible_bids.includes(bid), `Impossible bid of ${bid.toString()}`);

        // if this is the last bid, it is not a pass and the high bid is pass, then
        // the bid was forced

        const hand = this.this_hand

        if ((hand.bid_count === 3 ) && (!bid.is_pass) && (hand.high_bid.is_pass)) {
            hand.bid_forced = true;
        }

        // if it is not a pass bid, it must be the highest bid so far

        if (!bid.is_pass) {
            hand.high_bid = bid;
            hand.high_bidder = hand.next_bidder;
        }

        // store the bid, increase the bid count and move on to the next bidder

        hand.bids[hand.next_bidder] = bid;
        hand.bid_count += 1;
        hand.next_bidder = Game.inc_player(hand.next_bidder);

        // If everyone passed, we reshuffle.

        let result: BidResult = BID_RESULT_AGAIN;

        if (hand.bid_count === 4) {

            if (hand.high_bid.is_pass) {

                hand.bid_count = 0;
                hand.first_bidder = Game.inc_player(hand.first_bidder);
                hand.next_bidder = hand.first_bidder;
                hand.bid_forced = false;
                hand.bids = [];

                this.next_step = STEP.BID;

                result = BID_RESULT_RESHUFFLE;

                this.shake_and_pull();
            }
            else {
                this.next_step = STEP.TRUMP;
                result = BID_RESULT_DONE;
            }
        }
        return result
    }

    // See who is supposed to call trumps and what the possible trumps are based
    // on the rules. Returns the name of the player and a list of possible trumps.

    get_trump_caller(): [Player, Trump[]] {

        const hand = this.this_hand

        assert(hand.bid_count === 4, 'Cannot get trump caller until everyone has bid');
        assert(!hand.high_bid.is_pass, 'Cannot get trump caller when high bid is "pass"');
        assert(!hand.have_trump, 'Cannot get trump caller when trump has been called');

        // The first 8 are always possible trumps - blanks to sixes and doubles

        const possible_trumps = Trump.ALL.slice(0, 8);

        assert(possible_trumps.length === 8);

        let caller = hand.high_bidder;

        if (hand.partner_calls) {
            caller = Game.partner_for(caller);
        }

        const player = this.players[caller];

        const can_sevens =
            ( !hand.partner_calls ) &&
            ( hand.high_bid.total >= 42 ) &&
            ( this.rules.sevens_allowed );

        const can_nello =
            ( !hand.partner_calls ) &&
            ( hand.high_bid.total >= 42 ) &&
            ( ( this.rules.nello_allowed === 'ALWAYS' ) ||
            ( ( this.rules.nello_allowed === 'FORCE' ) && ( hand.bid_forced ) ) );

        let can_plunge =
            ( this.rules.plunge_allowed ) &&
            ( hand.high_bid.total >= 42 ) &&
            ( hand.high_bid.marks >= this.rules.plunge_min_marks ) &&
            ( hand.high_bid.marks <= this.rules.plunge_max_marks ) &&
            ( !hand.partner_calls );

        // see if the caller has 4 doubles

        if (can_plunge) {
            let double_count = 0;
            for (const bone of hand.pulled_bones[caller]) {
                if (bone.is_double) {
                    double_count += 1;
                }
            }
            can_plunge = double_count >= 4;
        }

        // now add the rest

        if (this.rules.follow_me_doubles.has('HIGH')) {
            possible_trumps.push(Trump.find('follow-me-hi'));
        }

        if (this.rules.follow_me_doubles.has('LOW')) {
            possible_trumps.push( Trump.find( 'follow-me-lo' ) );
        }

        if (this.rules.follow_me_doubles.has('HIGH_SUIT')) {
            possible_trumps.push( Trump.find( 'follow-me-os-hi' ) );
        }

        if (this.rules.follow_me_doubles.has('LOW_SUIT')) {
            possible_trumps.push( Trump.find( 'follow-me-os-lo' ) );
        }

        if (can_nello) {
            if (this.rules.nello_doubles.has('HIGH')) {
                possible_trumps.push( Trump.find( 'nello-hi' ) );
            }

            if (this.rules.nello_doubles.has('LOW')) {
                possible_trumps.push( Trump.find( 'nello-lo' ) );
            }

            if (this.rules.nello_doubles.has('HIGH_SUIT')) {
                possible_trumps.push( Trump.find( 'nello-os-hi' ) );
            }

            if (this.rules.nello_doubles.has('LOW_SUIT')) {
                possible_trumps.push( Trump.find( 'nello-os-lo' ) );
            }
        }

        if (can_sevens) {
            possible_trumps.push( Trump.find( 'sevens' ) );
        }

        if (can_plunge) {
            possible_trumps.push( Trump.find( 'plunge' ) );
        }

        return [player, possible_trumps];
    }

    // A player has called trumps

    player_trump(player: Player, trump: Trump): void {

        const hand = this.this_hand

        // sanity checks

        const [check_player, possible_trumps] = this.get_trump_caller();

        assert(player === check_player, `Player ${player} called trumps when it should be ${check_player}`);
        assert(possible_trumps.includes(trump), `Player ${player} called invalid trump ${trump.name}`);

        if (trump.name === 'plunge') {
            hand.partner_calls = true;
        }
        else {
            hand.have_trump = true;
            hand.trump = trump;

            if (hand.partner_calls) {
                hand.hand_leader = Game.partner_for(hand.high_bidder)
            }
            else {
                hand.hand_leader = hand.high_bidder;
            }

            hand.trick_leader = hand.hand_leader;
            hand.next_player = hand.hand_leader;
        }

        if (hand.have_trump) {
            this.next_step = STEP.PLAY
        }
    }

    // Get the next player and a list of possible bones he can play

    get_next_player(): [Player, Bone[]] {

        const hand = this.this_hand;

        assert(hand.have_trump, 'Get next player called with no trumps');
        assert(hand.trump, 'Get next player called with no trumps');

        const player_index = hand.next_player;

        const player = this.players[player_index];

        let add_all = false;

        let possible_bones = [];

        // Get all the valid bones the player has left

        const bones = hand.bones_left[player_index].filter((bone) => bone);

        if (hand.trump.name === 'sevens') {

            // in sevens, player must play closest to seven regardless of whether he
            // is leading or not

            let closest = 9;

            for(const bone of bones) {
                closest = Math.min(closest, Math.abs(bone.sum - 7));
            }

            for(const bone of bones) {
                if (Math.abs(bone.sum - 7) === closest) {
                    possible_bones.push(bone);
                }
            }
        }
        else if (hand.next_player === hand.trick_leader) {

            // player is leading, so can play anything

            add_all = true;
        }
        else {
            // player is following, so must follow suit

            const lead = hand.trick_bones[hand.trick_leader];

            for(const bone of bones) {
                if (bone.is_same_suit(lead, hand.trump)) {
                    possible_bones.push(bone);
                }
            }

            // If no bones in the same suit were found, the player can
            // play anything

            if (possible_bones.length === 0) {
                add_all = true;
            }
        }

        if (add_all) {
            possible_bones = [...bones];
        }

        return [player, possible_bones];
    }

    // Called when a player plays a bone - returns a PlayResult

    player_play(player: Player, bone: Bone): PlayResult {

        const [check_player , possible_bones] = this.get_next_player();

        assert(check_player === player, `Player ${player} playing out of turn. Expecting ${check_player}`);
        assert(possible_bones.includes(bone), `Player ${player} playing invalid bone ${bone.toString()}`);

        const result = new PlayResult();

        const hand = this.this_hand;

        const player_index = hand.next_player;

        // start a new trick if necessary

        if (hand.next_player === hand.trick_leader) {
            this.new_trick();
            assert(hand.this_trick);
            hand.this_trick.trick_leader = hand.trick_leader;
        }

        // remove the bone from the player's array

        hand.bones_left[ player_index ] =
            hand.bones_left[ player_index ].filter((other) => other !== bone);

        // add it to the trick bones

        hand.trick_bones[ player_index ] = bone;

        assert(hand.this_trick);

        hand.this_trick.trick_bones[ player_index ] = bone;

        // move to the next player

        hand.next_player = Game.inc_player( hand.next_player );

        // if we are playing nello, skip the partner of the bid winner

        const trump = hand.trump;
        assert(trump);

        if (trump.nello && ( hand.next_player === Game.partner_for( hand.high_bidder ) )) {
            hand.next_player = Game.inc_player( hand.next_player );
        }

        // check the results of this play

        if (hand.next_player === hand.trick_leader) {

            // the trick is over

            result.trick_over = true;

            // figure out the player that won the trick and how many points the
            // trick was worth

            let high_bone_value  = -1;
            result.trick_points  = 1;
            const lead = hand.trick_bones[ hand.trick_leader ];

            let p = hand.trick_leader;

            loop(4, (i) => {

                if (trump.nello && ( p === Game.partner_for( hand.high_bidder ) )) {
                    // Do nothing
                }
                else {
                    let play_bone = hand.trick_bones[ p ];

                    if (play_bone) {

                        const value = play_bone.value( lead , trump );

                        if (value > high_bone_value) {
                            high_bone_value = value;
                            result.trick_winner = p;
                        }

                        result.trick_points += play_bone.money;
                    }
                }

                p = Game.inc_player( p )
            });

            // allocate the points

            hand.points[ Game.team_for_player( result.trick_winner ) ] += result.trick_points;

            if (trump.nello) {

                if (hand.points[ Game.team_for_player( hand.high_bidder ) ] > 0) {
                    result.hand_over     = true;
                    result.winning_team  = Game.other_team( hand.high_bidder );
                    result.bid_made      = false;
                }
                else if (hand.trick_count === 7) {
                    result.hand_over     = true;
                    result.winning_team  = Game.team_for_player( hand.high_bidder );
                    result.bid_made      = true;
                }
            }
            else {

                if (hand.points[ Game.team_for_player( hand.high_bidder ) ] >= hand.high_bid.points) {
                    // bid was made
                    result.hand_over     = true;
                    result.winning_team  = Game.team_for_player( hand.high_bidder );
                    result.bid_made      = true;
                }
                else if (hand.points[ Game.other_team( hand.high_bidder ) ] > ( 42 - hand.high_bid.points )) {
                    // bidder was set
                    result.hand_over     = true;
                    result.winning_team  = Game.other_team( hand.high_bidder );
                    result.bid_made      = false;
                }
            }

            if (result.hand_over) {

                // this keeps us from attempting an early finish over and over

                if (hand.trick_count < 7) {
                    if (!hand.points_reached) {
                        result.early_finish = true;
                    }
                    else {
                        result.hand_over = false;
                    }
                }

                hand.points_reached = true;
            }

            // Now, store all of our state

            hand.this_trick.trick_winner    = result.trick_winner;
            hand.this_trick.trick_points    = result.trick_points;
            hand.this_trick.points.US       = hand.points.US;
            hand.this_trick.points.THEM     = hand.points.THEM;
            hand.this_trick.trick_over      = true;

            // # put the trick bones in the pile and clear them out

            hand.pile[ hand.trick_count - 1 ] = [...hand.trick_bones];
            hand.trick_bones = [];

            hand.trick_leader = result.trick_winner;
            hand.next_player  = result.trick_winner;

            if (result.hand_over) {
                if (result.early_finish) {
                  this.next_step = STEP.EARLY_FINISH
                }
            }
        }

        return result;
    }

    // Modifies the play result passed in

    finish_hand(play_result: PlayResult ): void {

        assert(play_result.hand_over, 'Calling finish hand when the hand is not over');

        const hand = this.this_hand

        assert(play_result.winning_team);

        this.marks[ play_result.winning_team ] += hand.high_bid.marks;

        if (this.marks[ play_result.winning_team ] >= 7) {
            play_result.game_over = true;
            this.next_step = STEP.GAME_OVER;
        }
        else {
            this.next_step = STEP.START_HAND;
        }

        hand.hand_over = true;
        hand.bid_made = play_result.bid_made;
    }

    play_it_out(keep_playing: boolean): void {
        if (keep_playing) {
            this.next_step = STEP.PLAY;
        }
    }

    set_players(players: Player[]): void {
        assert(players.length === 4);
        this.players = [...players];
    }

    get hand_in_progress(): boolean {
        if (this.hands.length === 0) {
            return false
        }
        return !this.this_hand.hand_over;
    }

    new_trick(): void {
        this.this_hand.tricks.push( new Trick() );
        this.this_hand.trick_count += 1;
    }

    // returns the target player name, the prompt and a list of choices

    next_turn(host: Player): [Player, STEP, string[]] {

        let target = host;
        const prompt = this.next_step;
        let choices: (Bid | Trump | Bone | string)[] = [];

        switch (prompt) {
            case STEP.START_HAND:
                target = host
                break;
            case STEP.BID:
                [target , choices] = this.get_next_bidder();
                break;
            case STEP.TRUMP:
                [target , choices] = this.get_trump_caller();
                break;
            case STEP.PLAY:
                [target , choices] = this.get_next_player();
                break;
            case STEP.EARLY_FINISH:
                target = host;
                choices = [ 'No' , 'Yes' ];
                break;
            default:
                assert(false);
        }
        return [ target , prompt , choices.map((item) => item.toString())];
    }
}

// #-------------------------------------------------------------------------------

// def automatic_test():

//     game_count = 0

//     while True:

//         rules = Rules()

//         rules.all_pass = random.choice( [ 'FORCE' , 'SHUFFLE' ] )
//         rules.nello_allowed = random.choice( [ 'NEVER' , 'ALWAYS' , 'FORCE' ] )
//         rules.plunge_allowed = random.choice( [ 'YES' , 'NO' ] )
//         rules.sevens_allowed = random.choice( [ 'YES' , 'NO' ] )
//         rules.plunge_min_marks = random.choice( [ 2 , 3 , 4 , 5 ] )
//         rules.plunde_max_marks = rules.plunge_min_marks
//         rules.min_bid = random.choice( [ '30' , '31' , '32' , '1-mark' , '2-marks' ] )
//         rules.forced_min_bid = random.choice( [ '30' , '31' , '32' , '1-mark' , '2-marks' ] )

//         rules.nello_doubles = []

//         for x in [ 'HIGH' , 'LOW' , 'HIGH_SUIT' , 'LOW_SUIT' ]:
//             if random.choice( [ True , False ] ):
//                 rules.nello_doubles.append( x )

//         rules.follow_me_doubles = []

//         for x in [ 'HIGH' , 'LOW' , 'HIGH_SUIT' , 'LOW_SUIT' ]:
//             if random.choice( [ True , False ] ):
//                 rules.follow_me_doubles.append( x )

//         players = [ 'A' , 'B' , 'C' , 'D' ]

//         game = Game( players , rules )

//         host = random.choice( players )

//         game_over = False

//         while not game_over:

//             target , prompt , choices = game.next_turn( host )

//             if prompt === STEP_START_HAND:

//                 game.start_hand()

//             elif prompt === STEP_GAME_OVER:

//                 game_over = True

//             else:

//                 choice = random.choice( choices.split( ',' ) )

//                 if prompt === STEP_BID:

//                     game.player_bid( target , Bid( choice ) )

//                 elif prompt === STEP_TRUMP:

//                     game.player_trump( target , Trump( choice ) )

//                 elif prompt === STEP_PLAY:

//                     play_result = game.player_play( target , Bone( choice ) )

//                     if play_result.trick_over:

//                         if play_result.hand_over:

//                             game.finish_hand( play_result )

//                 elif prompt === STEP_EARLY_FINISH:

//                     if choice.upper() === 'YES':

//                         game_over = True

//                     else:

//                         game.play_it_out( True )

//         game_count += 1

//         if game_count % 100 === 0:
//             print game_count


// #-------------------------------------------------------------------------------

// if __name__ === '__main__':

//     import sys

//     if len( sys.argv ) === 1:
//         interactive_test()
//     else:
//         automatic_test()
