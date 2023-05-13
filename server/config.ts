import assert from 'node:assert';
import dotenv from 'dotenv';

const YES = 'yes';

const variables: Record<string, string> = {
    /**
     * The version, injected using an environment variable at docker
     * image build time. Abset in dev
     */
    FT2_VERSION: 'local',

    /**
     * The base URL for the site
     */

    FT2_SITE_BASE_URL: 'https://fortee2.com',

    /**
     * The base URL for the server. It's only different in development
     */

    FT2_SERVER_BASE_URL: 'https://fortee2.com',

    /**
     * The directory for databases
     */

    FT2_DB_PATH: '',

    /**
     * The directory to save games
     */

    FT2_SAVE_PATH: '',

    /**
     * How often to send a ping - a string that 'ms' can understand
     */

    FT2_PING_INTERVAL: '',

    /**
     * How long a game can go idle before it times out - a 'ms' string
     */

    FT2_GAME_EXPIRY: '5m',

    /** How long do we wait for a game room reply before we close
     * the socket and reopen it. A 'ms' string
     */

    FT2_REPLY_TIMEOUT: '50s',

    /**
     * How long after we expire an invitation from slack - a 'ms' string
     */

    FT2_SLACK_INVITATION_EXPIRY: '10m',

    /**
     * How long to go without pongs or pings - a string that 'ms' can understand
     */

    FT2_PING_CLOSE_TIMEOUT: '',

    /**
     * How long to keep chat history - a string that 'ms' can understand
     */

    FT2_CHAT_HISTORY: '24h',

    /**
     * The session secret
     */

    FT2_SESSION_SECRET: '',

    /**
     * The session cookie name
     */

    FT2_SESSION_COOKIE_NAME: '',

    /**
     * For Google Sign in, set up at the developer's console
     */

    FT2_GSI_CLIENT_ID: '',
    FT2_GSI_SECRET: '',

    /**
     * Password for local users
     */

    FT2_LOCAL_PASSWORD: '',

    /**
     * Whether to connect to Slack. Turn it off when developing, so
     * that we don't interfere with the real server
     */

    FT2_SLACK_ON: YES,

    /**
     * Slack tokens
     */

    FT2_SLACK_BOT_TOKEN: '',
    FT2_SLACK_APP_TOKEN: '',
    FT2_SLACK_CLIENT_ID: '',
    FT2_SLACK_CLIENT_SECRET: '',

    /**
     * For Discord
     */

    FT2_DD_APP_ID: '',
    FT2_DD_APP_PK: '',
    FT2_DD_APP_SECRET: '',
    FT2_DD_BOT_TOKEN: '',
};

export default variables;

dotenv.config();

for (const name in variables) {
    const value = process.env[name];
    if (!value && variables[name]) {
        continue;
    }
    assert(value, `Missing environment variable ${name}`);
    variables[name] = value;
}

variables.PRODUCTION = process.env.NODE_ENV === 'production' ? YES : '';

export function on(value: string): boolean {
    return value === YES;
}

export function off(value: string): boolean {
    return !on(value);
}
