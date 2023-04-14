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
                return value;
            case 'renege':
            case 'plunge_allowed':
            case 'sevens_allowed':
                if (_.isString(value)) {
                    assert(['YES', 'NO'].includes(value));
                    return value === 'YES' ? true : false;
                }
                assert(_.isBoolean(value));
                return value;
            case 'plunge_min_marks':
            case 'plunge_max_marks':
                if (_.isString(value)) {
                    const n = parseInt(value, 10);
                    assert(!isNaN(n) && _.isSafeInteger(n));
                    assert(n > 0);
                    return n;
                }
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

    public readonly renege = false;
    public readonly all_pass: AllPass = 'FORCE';
    public readonly min_bid: string = '30';
    public readonly forced_min_bid: string = '30';
    public readonly follow_me_doubles: DoublesSuit[] = ['HIGH'];
    public readonly plunge_allowed: boolean = false;
    public readonly plunge_min_marks: number = 2;
    public readonly plunge_max_marks: number = 2;
    public readonly sevens_allowed: boolean = false;
    public readonly nello_allowed: NelloAllowed = 'NEVER';
    public readonly nello_doubles: DoublesSuit[] = ['HIGH_SUIT'];
    /** For testing, we fix the bones that are pulled */
    public readonly bones?: Bone[];

    constructor(bones?: Bone[]) {
        if (bones) {
            assert(_.uniq(bones).length = Bone.ALL.length);
        }
        this.bones = bones;
    }

    parts(): string[] {
        const result: string[] = [];
        if (this.renege) {
            result.push('renege');
        }
        result.push(`min ${this.min_bid}`);
        if (this.all_pass === 'SHUFFLE') {
            result.push('reshuffle');
        }
        else {
            result.push(`forced ${this.forced_min_bid}`);
        }
        if (this.plunge_allowed) {
            result.push(`plunge ${this.plunge_min_marks}-${this.plunge_max_marks}`);
        }
        if (this.sevens_allowed) {
            result.push('sevens');
        }
        if (this.nello_allowed === 'ALWAYS') {
            result.push('nello');
        }
        else if (this.nello_allowed === 'FORCE') {
            result.push('forced nello');
        }
        return result;
    }

    toJSON() {
        return {
            ...this,
            bones: this.bones ? Bone.toList(this.bones) : undefined
        };
    }

    static fromJson(json: string): Rules {
        return Object.assign(new Rules(), JSON.parse(json, reviver));
    }

    // AllPass=FORCE,NelloAllowed=NEVER,NelloDoublesHIGH=NO,NelloDoublesLOW=NO,NelloDoublesHIGH_SUIT=YES,NelloDoublesLOW_SUIT=NO,PlungeAllowed=NO,SevensAllowed=NO,FollowMeDoublesHIGH=YES,FollowMeDoublesLOW=NO,FollowMeDoublesHIGH_SUIT=NO,FollowMeDoublesLOW_SUIT=NO,PlungeMinMarks=2,PlungeMaxMarks=2,MinBid=30,ForcedMinBid=30

    static fromOldTournament(s: string): Rules {
        assert(s, 'Empty rules');
        const json = s.split(',').reduce((result, pair) => {
            const [key, value] = pair.split('=');
            switch (key) {
                case 'AllPass':
                    result.all_pass = value;
                    break;
                case 'NelloAllowed':
                    result.nello_allowed = value;
                    break;
                case 'NelloDoublesHIGH':
                    if (value ==='YES') {
                        result.nello_doubles.push('HIGH');
                    }
                    break;
                case 'NelloDoublesLOW':
                    if (value ==='YES') {
                        result.nello_doubles.push('LOW');
                    }
                    break;
                case 'NelloDoublesHIGH_SUIT':
                    if (value ==='YES') {
                        result.nello_doubles.push('HIGH_SUIT');
                    }
                    break;
                case 'NelloDoublesLOW_SUIT':
                    if (value ==='YES') {
                        result.nello_doubles.push('LOW_SUIT');
                    }
                    break;
                case 'PlungeAllowed':
                    result.plunge_allowed = value === 'YES';
                    break;
                case 'SevensAllowed':
                    result.sevens_allowed = value === 'YES';
                    break;
                case 'FollowMeDoublesHIGH':
                    if (value ==='YES') {
                        result.follow_me_doubles.push('HIGH');
                    }
                    break;
                case 'FollowMeDoublesLOW':
                    if (value ==='YES') {
                        result.follow_me_doubles.push('LOW');
                    }
                    break;
                case 'FollowMeDoublesHIGH_SUIT':
                    if (value ==='YES') {
                        result.follow_me_doubles.push('HIGH_SUIT');
                    }
                    break;
                case 'FollowMeDoublesLOW_SUIT':
                    if (value ==='YES') {
                        result.follow_me_doubles.push('LOW_SUIT');
                    }
                    break;
                case 'PlungeMinMarks':
                    result.plunge_min_marks = parseInt(value, 10);
                    break;
                case 'PlungeMaxMarks':
                    result.plunge_max_marks = parseInt(value, 10);
                    break;
                case 'MinBid':
                    result.min_bid = value;
                    break;
                case 'ForcedMinBid':
                    result.forced_min_bid = value;
                    break;
                default:
                    assert(false, `Invalid key "${key}"`);
            }
            return result;
        },
        {
            nello_doubles: [],
            follow_me_doubles: [],
        } as Record<keyof Rules, any>);

        return this.fromJson(JSON.stringify(json));
    }

    static fromAny(s: string) {
        assert(s, 'Empty rules');
        if (s.includes('AllPass')) {
            return this.fromOldTournament(s);
        }
        return this.fromJson(s);
    }
}
