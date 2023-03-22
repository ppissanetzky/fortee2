import assert from 'node:assert';
import dotenv from 'dotenv';

const variables: Record<string, string> = {
    FT2_GSI_CLIENT_ID: '',
    FT2_GSI_SECRET: '',
};

export default variables;

dotenv.config();

for (const name in variables) {
    const value = process.env[name];
    assert(value, `Missing environment variable ${name}`);
    variables[name] = value;
}
