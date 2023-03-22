import assert from 'node:assert';
import dotenv from 'dotenv';

const variables: Record<string, string> = {

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
    assert(value, `Missing environment variable ${name}`);
    variables[name] = value;
}
