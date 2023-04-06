import assert from 'node:assert';

import type { Request, Response, NextFunction } from 'express';
import { Issuer, generators, BaseClient } from 'openid-client';

import { makeDebug } from './utility';
import config from './config';

const debug = makeDebug('slack-auth');

declare module 'express-session' {
    interface SessionData {
        codeVerifier?: string;
        gameRoomToken?: string;
    }
}

/**
 * The URL used to get the OpenID configuration from Slack, the "issuer"
 * @see https://api.slack.com/authentication/sign-in-with-slack
 */

const SLACK_DISCOVER_URL = 'https://slack.com/.well-known/openid-configuration';

let issuer: Issuer<BaseClient>;

async function getIssuer() {
    if (!issuer) {
        issuer = await Issuer.discover(SLACK_DISCOVER_URL);
    }
    return issuer;
}

export async function slackAuth(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) {
        return next();
    }
    try {
        const url = new URL(req.url, config.FT2_SERVER_BASE_URL);
        const redirectUri = `${url.origin}${url.pathname}`;

        debug('redirect uri', redirectUri);

        const issuer = await getIssuer();
        const client =  new issuer.Client({
            client_id: config.FT2_SLACK_CLIENT_ID,
            client_secret: config.FT2_SLACK_CLIENT_SECRET,
            redirect_uris: [redirectUri],
            response_types: ['code']
        });

        /** If there is no code, this is our initial request */

        if (!req.query.code) {

            /** Make a challenge verification code and save it in the session */

            const codeVerifier = generators.codeVerifier();

            req.session.codeVerifier = codeVerifier;

            await new Promise<void>((resolve, reject) => {
                req.session.save((error) => error ? reject(error) : resolve());
            });

            /** Get the Slack auth URL */

            const url = client.authorizationUrl({
                scope: 'openid email profile',
                code_challenge: generators.codeChallenge(codeVerifier),
                code_challenge_method: 'S256',
                team: 'T050GLABCFN'
            });

            debug('redirecting to', url);

            /** Go there */

            return res.redirect(url);
        }

        /** Otherwise, it is the callback from Slack */

        /** Pull the challenge verifier from the session */

        const { codeVerifier } = req.session;
        assert(codeVerifier, 'Missing session.codeVerifier');
        req.session.codeVerifier = undefined;

        /** Verify the code */

        const { access_token } = await client.callback(redirectUri,
            client.callbackParams(req),
            {code_verifier: codeVerifier});
        assert(access_token, 'Missing access_token');

        /** Get the user info */

        const userInfo = await client.userinfo(access_token);
        debug('userinfo %j', userInfo);
        assert(userInfo.ok, 'User info not ok');
        const { sub: id, name } = userInfo;
        assert(id, 'Missing user ID');
        assert(name, `Missing name for ${id}`);

        /** All is good, sign-in this user */
        await new Promise<void>((resolve, reject) => {
            req.login({id, name},
                (error) => error ? reject(error) : resolve());
        });

        assert(req.user, 'User came out wrong');
        assert(req.user.id === id, 'User ID came out wrong');
        assert(req.user.name, 'User name came out wrong');

        // Continue
        next();
    }
    catch (error) {
        res.sendStatus(401);
        req.logout({keepSessionInfo: false}, () => undefined);
        throw error;
    }
}
