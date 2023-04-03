import assert from 'node:assert';
import ms from 'ms';
import { makeDebug, makeToken } from './utility';
import config from './config';
import GameRoom from './game-room';
import { Rules } from './core';

/**
 * This needs to be JSON.stringifyable
 */

export interface InvitationInputs {
    /** The Slack user IDs of the host that initiated it all */
    readonly host: string;
    /** Either the user ID of the chosen partner or a blank string for a bot */
    partner: string;
    /** Zero, one or two user IDs */
    team: string[];
    /** A map from each user ID to their display name */
    names: Record<string, string>;
}

export interface MessageInfo {
    /** The user ID that received the message */
    readonly recipient: string;

    /** The channel ID (it's a DM) */
    readonly channel: string;

    /**
     * The ts of the message - needed for updates and
     * may change each time it is updated
     */
    ts: string;
}

export class Invitation {

    private static N = 1;

    /** A map of all the current invitations */

    public static readonly all = new Map<string, Invitation>();

    /** The inputs used to create it */

    public readonly inputs: InvitationInputs;

    /** The user IDs and names from the inputs */

    public readonly users: string[];
    public readonly names: string[];

    /** The token/ID for this invitation */

    public readonly id: string;

    /*** Maps user tokens to user IDs */

    public readonly tokens = new Map<string, string>();

    /** A map of user ID to URL given out */

    public readonly urls = new Map<string, string>();

    /** The game room token */

    public readonly gameRoomToken: string;

    /** A promise that is resolved once the invitation expires */

    public readonly onceExpired: Promise<void>;

    /** Debugger */

    private readonly debug = makeDebug('invitation').extend(`${Invitation.N++}`);

    constructor(inputs: InvitationInputs, rules: Rules) {
        this.inputs = inputs;
        this.users = Object.keys(inputs.names);
        this.names = Object.values(inputs.names);

        let id;
        while (!id || Invitation.all.has(id)) {
            id = makeToken(16, 'base64url');
        }
        this.id = id;

        this.debug('created', this.id,
            'from ', inputs.host,
            'partner', inputs.partner,
            'team', JSON.stringify(inputs.team),
            'names', JSON.stringify(this.names));

        /**
         * Generate a token for each user, add it to the tokens
         * map and generate a URL
         *
         */

        for (const user of this.users) {
            let userToken;
            while (!userToken || this.tokens.has(userToken)) {
                userToken = makeToken(8, 'hex');
            }
            this.tokens.set(userToken, user);
            this.urls.set(user, `${config.FT2_SERVER_BASE_URL}/slack-auth/${this.id}/${userToken}`);
        }

        this.debug('%j', Array.from(this.urls.entries()));

        /** Add it to the global map */

        Invitation.all.set(this.id, this);

        const host = inputs.names[inputs.host];

        assert(host, 'How can we not have a host?');

        const room = new GameRoom(
            rules,
            host,
            inputs.names[inputs.partner] || '',
            inputs.team.map((id) => inputs.names[id] || ''));

        this.gameRoomToken = room.token;

        /** Set up the expiration */

        this.onceExpired = new Promise((resolve) => {
            setTimeout(() => {
                if (!room.started) {
                    this.debug('expired for', this.users);
                    /** Remove the invitation */
                    Invitation.all.delete(this.id);
                    /** Remove the game room */
                    this.debug('removing room', room.id, room.token);
                    GameRoom.rooms.delete(room.token);
                    resolve();
                }
            }, ms(config.FT2_SLACK_INVITATION_EXPIRY));
        });
    }

    /** The ID of the host */

    get host(): string {
        return this.inputs.host;
    }

    /** An array of user IDs other than this one */

    public others(than: string) {
        return this.users.filter((user) => user !== than);
    }

    public static invoked(id: string, userToken: string) {
        //
    }
}
