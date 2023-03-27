import assert from 'node:assert';
import dotenv from 'dotenv';

const variables: Record<string, string> = {

    /**
     * Whether to allow local logins
     */
    
    FT2_ALLOW_LOCAL: 'no',

    /**
     * How often to send a ping - a string that 'ms' can understand
     */

    FT2_PING_INTERVAL: '',

    /**
     * How long to go without pongs or pings - a string that 'ms' can understand
     */

    FT2_PING_CLOSE_TIMEOUT: '',

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

    FT2_LOCAL_PASSWORD: ''
};

export default variables;

dotenv.config();

for (const name in variables) {
    const value = process.env[name];
    if (!value && variables[name]) {
        console.log(`Using default value for ${name}`);
        continue;
    }
    assert(value, `Missing environment variable ${name}`);
    variables[name] = value;
}
