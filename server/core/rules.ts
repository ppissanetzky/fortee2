import assert from 'node:assert';
import _ from 'lodash';
import { Bid, Bone } from '.';

// '''
// AllPass = FORCE | SHUFFLE
// NelloAllowed = NEVER | ALWAYS | FORCE
// NelloDoublesHIGH = YES | NO
// NelloDoublesLOW = YES | NO
// NelloDoublesHIGH_SUIT = YES | NO
// NelloDoublesLOW_SUIT = YES | NO
// PlungeAllowed = YES | NO
// SevensAllowed = YES | NO
// FollowMeDoublesHIGH = YES | NO
// FollowMeNelloDoublesLOW = YES | NO
// FollowMeNelloDoublesHIGH_SUIT = YES | NO
// FollowMeNelloDoublesLOW_SUIT = YES | NO
// PlungeMinMarks = 2
// PlungeMaxMarks = 2
// MinBid = 30
// ForcedMinBid = 30


// defaults

// AllPass = FORCE
// NelloAllowed = NEVER
// NelloDoublesHIGH = NO
// NelloDoublesLOW = NO
// NelloDoublesHIGH_SUIT = YES
// NelloDoublesLOW_SUIT = NO
// PlungeAllowed = NO
// SevensAllowed = NO
// FollowMeDoublesHIGH = YES
// FollowMeDoublesLOW = NO
// FollowMeDoublesHIGH_SUIT = NO
// FollowMeDoublesLOW_SUIT = NO
// PlungeMinMarks = 2
// PlungeMaxMarks = 2
// MinBid = 30
// ForcedMinBid = 30

// '''

type AllPass = 'FORCE' | 'SHUFFLE';
type NelloAllowed = 'NEVER' | 'ALWAYS' | 'FORCE';
type DoublesSuit = 'HIGH_SUIT' | 'LOW_SUIT' | 'HIGH' | 'LOW';

function replacer(key: any, value: any): any {
    if (key === 'nello_doubles' || key === 'follow_me_doubles') {
        return Array.from(value.values());
    }
    if (key === 'bones' && value) {
        return Bone.toList(value);
    }
    return value;
}

function reviver(key: string, value: any): any {
    try {
        switch (key) {
            case 'all_pass':
                assert(_.isString(value));
                assert(['FORCE', 'SHUFFLE'].includes(value));
                return value;
            case 'nello_allowed':
                assert(_.isString(value));
                assert(['NEVER', 'ALWAYS', 'FORCE'].includes(value));
                return value;
            case 'nello_doubles':
            case 'follow_me_doubles':
                assert(_.isArray(value));
                assert(value.every((item) =>
                    _.isString(item) && ['HIGH_SUIT', 'LOW_SUIT', 'HIGH', 'LOW'].includes(item)));
                return new Set(value);
            case 'plunge_allowed':
            case 'sevens_allowed':
                assert(_.isBoolean(value));
                return value;
            case 'plunge_min_marks':
            case 'plunge_max_marks':
                assert(_.isNumber(value));
                assert(value >= 0);
                return value;
            case 'min_bid':
            case 'forced_min_bid':
                assert(_.isString(value));
                Bid.find(value);
                return value;
            case 'bones':
                assert(_.isArray(value));
                return Bone.list(value);
            default:
                break;
        }
        return value;
    }
    catch (error) {
        assert(false, `"${key}" has a problem: ${error}"`);
    }
}

export default class Rules {

    public readonly all_pass: AllPass = 'FORCE';
    public readonly nello_allowed: NelloAllowed = 'NEVER';
    public readonly nello_doubles: Set<DoublesSuit> = new Set(['HIGH_SUIT']);
    public readonly plunge_allowed: boolean = false;
    public readonly sevens_allowed: boolean = false;
    public readonly follow_me_doubles: Set<DoublesSuit> = new Set(['HIGH']);
    public readonly plunge_min_marks: number = 2;
    public readonly plunge_max_marks: number = 2;
    public readonly min_bid: string = '30';
    public readonly forced_min_bid: string = '30';
    /** For testing, we fix the bones that are pulled */
    public readonly bones?: Bone[];

    constructor(bones?: Bone[]) {
        if (bones) {
            assert(_.uniq(bones).length = Bone.ALL.length);
        }
        this.bones = bones;
    }

    toJson() {
        return JSON.stringify(this, replacer, '  ');
    }

    static fromJson(json: string): Rules {
        return Object.assign(new Rules(), JSON.parse(json, reviver));
    }
}
