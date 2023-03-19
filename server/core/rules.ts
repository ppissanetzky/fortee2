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

export default class Rules {

    public readonly all_pass: AllPass = 'FORCE';
    public readonly nello_allowed: NelloAllowed = 'NEVER';
    public readonly nello_doubles: Set<DoublesSuit> = new Set(['HIGH_SUIT']);
    public readonly plunge_allowed: boolean = false;
    public readonly sevens_allowed: boolean = false;
    public readonly follow_me_doubles: Set<DoublesSuit> = new Set(['HIGH']);
    public readonly plunge_min_marks: number = 2;
    public readonly plunge_max_marks: number = 2;
    // A bid name
    public readonly min_bid: string = '30';
    // A bid name
    public readonly forced_min_bid: string = '30';

    constructor() {}


    // in_set<T>(value: any, set: Set<T>):

    //     if value in set:
    //         return 'YES'
    //     else:
    //         return 'NO'

    // def change_set( self , value , set , yes_no ):

    //     is_in = value in set

    //     if yes_no == 'YES' and not is_in:
    //         set.append( value )
    //     elif yes_no == 'NO' and is_in:
    //         set.remove( value )

    // def as_string( self ):

    //     strings = []

    //     strings.append( 'AllPass=' + self.all_pass )
    //     strings.append( 'NelloAllowed=' + self.nello_allowed )
    //     strings.append( 'NelloDoublesHIGH=' + self.in_set( 'HIGH' , self.nello_doubles ) )
    //     strings.append( 'NelloDoublesLOW=' + self.in_set( 'LOW' , self.nello_doubles ) )
    //     strings.append( 'NelloDoublesHIGH_SUIT=' + self.in_set( 'HIGH_SUIT' , self.nello_doubles ) )
    //     strings.append( 'NelloDoublesLOW_SUIT=' + self.in_set( 'LOW_SUIT' , self.nello_doubles ) )
    //     strings.append( 'PlungeAllowed=' + self.plunge_allowed )
    //     strings.append( 'SevensAllowed=' + self.sevens_allowed )
    //     strings.append( 'FollowMeDoublesHIGH=' + self.in_set( 'HIGH' , self.follow_me_doubles ) )
    //     strings.append( 'FollowMeDoublesLOW=' + self.in_set( 'LOW' , self.follow_me_doubles ) )
    //     strings.append( 'FollowMeDoublesHIGH_SUIT=' + self.in_set( 'HIGH_SUIT' , self.follow_me_doubles ) )
    //     strings.append( 'FollowMeDoublesLOW_SUIT=' + self.in_set( 'LOW_SUIT' , self.follow_me_doubles ) )
    //     strings.append( 'PlungeMinMarks=' + str( self.plunge_min_marks ) )
    //     strings.append( 'PlungeMaxMarks=' + str( self.plunge_max_marks ) )
    //     strings.append( 'MinBid=' + self.min_bid )
    //     strings.append( 'ForcedMinBid=' + self.forced_min_bid )

    //     return ','.join( strings )

    // def load_from_string( self , string ):

    //     strings = string.split( ',' )

    //     for s in strings:

    //         key , separator , value = s.partition( '=' )

    //         if len( separator ) == 0 or len( value ) == 0:
    //             continue

    //         if key == 'AllPass':
    //             self.all_pass = value
    //         elif key == 'NelloAllowed':
    //             self.nello_allowed = value
    //         elif key == 'PlungeAllowed':
    //             self.plunge_allowed = value
    //         elif key == 'SevensAllowed':
    //             self.sevens_allowed = value
    //         elif key == 'PlungeMinMarks':
    //             self.plunge_min_marks = int( value )
    //         elif key == 'PlungeMaxMarks':
    //             self.plunde_max_marks = int( value )
    //         elif key == 'MinBid':
    //             self.min_bid = value
    //         elif key == 'ForcedMinBid':
    //             self.forced_min_bid = value
    //         elif key == 'NelloDoublesHIGH':
    //             self.change_set( 'HIGH' , self.nello_doubles , value )
    //         elif key == 'NelloDoublesLOW':
    //             self.change_set( 'LOW' , self.nello_doubles , value )
    //         elif key == 'NelloDoublesHIGH_SUIT':
    //             self.change_set( 'HIGH_SUIT' , self.nello_doubles , value )
    //         elif key == 'NelloDoublesLOW_SUIT':
    //             self.change_set( 'LOW_SUIT' , self.nello_doubles , value )
    //         elif key == 'FollowMeDoublesHIGH':
    //             self.change_set( 'HIGH' , self.follow_me_doubles , value )
    //         elif key == 'FollowMeDoublesLOW':
    //             self.change_set( 'LOW' , self.follow_me_doubles , value )
    //         elif key == 'FollowMeDoublesHIGH_SUIT':
    //             self.change_set( 'HIGH_SUIT' , self.follow_me_doubles , value )
    //         elif key == 'FollowMeDoublesLOW_SUIT':
    //             self.change_set( 'LOW_SUIT' , self.follow_me_doubles , value )
}
