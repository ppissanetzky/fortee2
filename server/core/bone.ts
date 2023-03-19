import assert from 'node:assert';
import _ from 'lodash';
import type Trump from './trump';

type Dots = number;

export default class Bone {

    public static readonly ALL: Bone[] = [
        new Bone(0,0),new Bone(0,1),new Bone(0,2),new Bone(0,3),new Bone(0,4),new Bone(0,5),new Bone(0,6),
        new Bone(1,1),new Bone(1,2),new Bone(1,3),new Bone(1,4),new Bone(1,5),new Bone(1,6),
        new Bone(2,2),new Bone(2,3),new Bone(2,4),new Bone(2,5),new Bone(2,6),
        new Bone(3,3),new Bone(3,4),new Bone(3,5),new Bone(3,6),
        new Bone(4,4),new Bone(4,5),new Bone(4,6),
        new Bone(5,5),new Bone(5,6),
        new Bone(6,6)
    ];

    public static pull(): Bone[] {
        return _.shuffle(this.ALL);
    }

    static find(name: string): Bone {
        const result = this.ALL.find((bone) => bone.toString() === name);
        assert(result, `Invalid bone "${name}"`);
        return result;
    }

    private constructor(
        private readonly a: Dots,
        private readonly b: Dots)
    {}

    toString(): string {
        return `${this.suit}.${this.other_suit(this.suit)}`;
    }

    get sum(): number {
        return this.a + this.b;
    }

    get big(): Dots {
        return Math.max(this.a, this.b);
    }

    get suit(): Dots {
        return this.big;
    }

    get is_double(): boolean {
        return this.a === this.b;
    }

    get money(): number {
        const sum = this.a + this.b;
        return sum === 5 || sum === 10 ? sum : 0;
    }

    get is_money(): boolean {
        return this.money > 0;
    }

    has_suit(suit: Dots): boolean {
        return this.a === suit || this.b === suit;
    }

    other_suit(suit: Dots): Dots {
        return this.a === suit ? this.b : this.a;
    }

    is_trump(trump: Trump): boolean {
        if (!trump.has_trump) {
            return false;
        }
        if (trump.double_trump) {
            return this.is_double;
        }
        return this.has_suit(trump.suit);
    }

    is_same_suit(lead: Bone, trump: Trump): boolean {

        /**
         * if at least one is a trump, we return true if they are both trumps
         */

        if (lead.is_trump(trump) || this.is_trump(trump)) {
            return lead.is_trump(trump) && this.is_trump(trump)
        }

        /**
         * if doubles are their own suit and at least one of the two bones is a
         * double, we return true if they are both doubles, false otherwise
         */

        if (trump.double_os && (lead.is_double || this.is_double )) {
            return lead.is_double && this.is_double;
        }

        /**
         * sevens has no suits or trumps, all dominoes are in the same 'suit'
         */

        if (trump.name === 'sevens') {
            return true;
        }

        /**
         * otherwise, we go by the suit of the lead bone
         */

        return this.has_suit(lead.suit);
    }

    /**
     * Given a bone, the lead bone and the trump; this function returns a numerical
     * value for the bone.
     * The result is between 0 and 16
     * where 0 is trash ( neither lead suit nor trump )
     * 1 to 8 is lead suit but not trump, where 8 is the double
     * 9 to 16 is a trump where 16 is the trump double
     */

    value(lead: Bone, trump: Trump): number {
        let result = 0;

        if (this.is_trump(trump)) {
            if (trump.double_trump) {
                result = this.a + 1;
            }
            else if (this.is_double) {
                result = 8;
            }
            else {
                result = this.other_suit(trump.suit) + 1;
            }
            result += 8
        }
        else {
            if (trump.name === 'sevens') {
                result = 7 - Math.abs(7 - this.sum);
            }
            else if (!this.is_same_suit(lead, trump)) {
                result = 0
            }
            else if (trump.double_os && this.is_double) {
                result = trump.double_hi ? this.a + 1 : 7 - this.a;
            }
            else if (this.is_double) {
                result = trump.double_hi ? 8 : 0;
            }
            else {
                result = this.other_suit(lead.suit) + 1;
            }
        }
        return result
    }
}
