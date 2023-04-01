import _ from 'lodash';
import { BasePlayer } from './base-player';
import getNextBotName from './bot-names';

export default class RandomBot extends BasePlayer {

    private readonly fastAF: boolean;

    constructor(name = '', fastAF = false) {
        super(name || getNextBotName());
        this.fastAF = fastAF;
        this.with({
            name: 'delay',
            bid: () => this.delay(),
            call: () => this.delay(),
            play: () => this.delay(),
        });
    }

    protected async delay(): Promise<void> {
        if (!this.fastAF) {
            return new Promise<void>((resolve) => {
                setTimeout(resolve, _.random(500, 2000));
            });
        }
    }

    override async startingHand(): Promise<void> {
        await super.startingHand();
        return this.delay();
    }
}


// interface BoneWithPlayer {
//     readonly name: string;
//     readonly bone: Bone;
// }

// export class DebugBot extends PassBot {

//     private dbg = makeDebug('bot');
//     protected partner = '';
//     protected players: string[] = [];
//     protected trick: BoneWithPlayer[] = [];
//     protected pile: BoneWithPlayer[][] = [];

//     constructor() {
//         super(true);
//         this.dbg = this.dbg.extend(this.name);
//     }

//     protected debug(arg: any, ...args: any[]): void {
//         this.dbg(arg, ...args);
//     }

//     /**
//      * Returns all bones played up to this point, EXCLUDING
//      * the current trick
//      */

//     get played(): Bone[] {
//         return _.flatten(this.pile).map(({bone}) => bone);
//     }

//     /**
//      * Returns all the bones that have not been played and are also not
//      * in the 'exclude' array.
//      */

//     remaining(exclude: Bone[] = []): Bone[] {
//         return _.difference(Bone.ALL, this.played, exclude);
//     }

//     table({ table } : { table: string[] }) {
//         let index = table.indexOf(this.name);
//         assert(index >= 0);
//         index += 2;
//         if (index > 3) {
//             index -= 4;
//         }
//         this.players = table;
//         this.partner = table[index];
//         this.debug('partner', this.partner);
//     }

//     startingHand(): Promise<void> {
//         this.pile = [];
//         return super.startingHand();
//     }


//     async leadPlay(possible: Bone[]): Promise<Bone> {
//         const {trump} = this;
//         assert(trump);
//         this.debug('i am leading');
//         const remaining = this.remaining();
//         const winners = possible.filter((bone) => bone.beatsAll(trump, remaining));
//         this.debug('played %o', Bone.toList(this.played));
//         this.debug('remaining %o', Bone.toList(remaining));
//         this.debug('i have %o', Bone.toList(possible));
//         this.debug('winners %o', Bone.toList(winners));
//         const winner = _.sample(winners);
//         if (winner) {
//             this.debug('this is a sure winner', winner.id);
//             return winner;
//         }
//         return super.play({possible});
//     }

//     async followPlay(lead: Bone, possible: Bone[]): Promise<Bone> {
//         const {trump} = this;
//         assert(trump);

//         /** If my partner has already played */
//         const partnerBone = this.trick.find(({name}) => name === this.partner)?.bone;

//         if (partnerBone) {
//             /** My partner is leading */
//             if (partnerBone === lead) {
//                 this.debug('my partner lead', lead.id);

//                 /** My partner's bone will definitely win */
//                 if (partnerBone.beatsAll(trump, this.remaining())) {
//                     this.debug('my partner will win');

//                     /** Get the best money bone and, if we have one, play it */
//                     const mostMoney = Bone.mostMoney(possible);
//                     if (mostMoney) {
//                         this.debug('i got money', mostMoney.id);
//                         return mostMoney;
//                     }
//                 }
//             }
//         }

//         /** Throw trash */
//         const trash = Bone.trash(trump, possible);
//         return trash;
//     }

//     async play({ possible } : { possible: Bone[] }): Promise<Bone> {
//         /** short-circuit when there's only one possible play */
//         if (possible.length === 1) {
//             return super.play({possible});
//         }

//         /** We are leading */
//         if (this.trick.length === 0) {
//             return this.leadPlay(possible);
//         }

//         /** We are following */
//         const [{bone}] = this.trick;
//         return this.followPlay(bone, possible);
//     }

//     playSubmitted(msg : { from: string, bone: Bone }): void {
//         super.playSubmitted(msg);
//         this.trick.push({name: msg.from, bone: msg.bone});
//     }

//     async endOfTrick(msg : { winner: string, points: number, status: Status }): Promise<void> {
//         const result = await super.endOfTrick(msg);
//         this.pile.push(this.trick);
//         this.trick = [];
//         return result;
//     }
// }
