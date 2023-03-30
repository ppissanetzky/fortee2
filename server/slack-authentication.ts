import assert from 'node:assert';

import type { Express } from 'express';
import { Issuer, generators, BaseClient } from 'openid-client';

import { Invitation } from './invitations';
import { makeDebug } from './utility';
import config from './config';

const debug = makeDebug('slack-auth');

declare module 'express-session' {
    interface SessionData {
        codeVerifier: string;
    }
}

const SLACK_DISCOVER_URL = 'https://slack.com/.well-known/openid-configuration';

export function setupSlackAuthentication(app: Express) {

    let client: BaseClient;

    async function getClient(redirectUri: string): Promise<BaseClient> {
        if (!client) {
            const issuer = await Issuer.discover(SLACK_DISCOVER_URL);
            debug('issuer : %j', issuer.metadata);
            client = new issuer.Client({
                client_id: config.FT2_SLACK_CLIENT_ID,
                client_secret: config.FT2_SLACK_CLIENT_SECRET,
                redirect_uris: [redirectUri],
                response_types: ['code']
            });
            debug('client created');
        }
        return client;
    }

    function getUser(iid: string, userToken: string) {
        const invitation = Invitation.all.get(iid);
        assert(invitation, `Invitation "${iid}" not found`);
        const user = invitation.tokens.get(userToken);
        assert(user, `User token "${userToken}" not found`);
        const name = invitation.inputs.names.get(user);
        assert(name, `No name for user ${user}`);
        const userId = `slack/${user}`;
        return {
            invitation,
            user,
            name,
            userId,
            redirectUri: `${config.FT2_SITE_BASE_URL}/slack-login/${iid}/${userToken}`,
            playUri: `${config.FT2_SITE_BASE_URL}/play/?t=${invitation.gameRoomToken}`
        };
    }

    app.get('/slack-auth/:iid/:userToken', async (req, res) => {
        const { params: {iid, userToken } } = req;
        const { userId , redirectUri, playUri } = getUser(iid, userToken);

        debug('start %j', req.session);

        // If we have the right user, just redirect to play

        if (req.user?.id === userId) {
            return res.redirect(playUri);
        }

        try {
            // We have a user but it's not the one we expect, so we logout
            if (req.user) {
                debug('have another user : %j', req.user);
                await new Promise<void>((resolve, reject) =>
                    req.logout({keepSessionInfo: false}, (error) => error ? reject(error) : resolve()));
                debug('after logout %j', req.session);
            }

            const codeVerifier = generators.codeVerifier();
            req.session.codeVerifier = codeVerifier;

            debug('with cv %j', req.session);

            await new Promise<void>((resolve, reject) => {
                req.session.save((error) => error ? reject(error) : resolve());
            });

            debug('saved %j', req.session);

            // Create the OpenId client
            const client = await getClient(redirectUri);
            // Get the Slack auth URL
            const url = client.authorizationUrl({
                scope: 'openid email profile',
                code_challenge: generators.codeChallenge(codeVerifier),
                code_challenge_method: 'S256',
            });
            // Go there
            res.redirect(url);
        }
        catch (error) {
            res.sendStatus(401);
            req.logout({keepSessionInfo: false}, () => undefined);
            throw error;
        }
    });

    app.get('/slack-login/:iid/:userToken', async (req, res) => {
        try {
            const { params: {iid, userToken } } = req;
            const { user, userId, redirectUri, playUri } = getUser(iid, userToken);

            debug('start %j', req.session);

            const { codeVerifier } = req.session;
            assert(codeVerifier, 'Missing session.codeVerifier');

            const tokenSet = await client.callback(redirectUri,
                client.callbackParams(req),
                {code_verifier: codeVerifier});
            debug('received and validated tokens %j', tokenSet);
            debug('validated ID token claims %j', tokenSet.claims());
            const { access_token } = tokenSet;
            assert(access_token, 'Missing access_token');
            const userInfo = await client.userinfo(access_token);
            debug('userinfo %j', userInfo);
            assert(userInfo.ok, 'User info not ok');

            const { sub, name } = userInfo;
            assert(sub === user, `Expecting ${user} but got ${sub}`);
            assert(name, 'Missing userInfo.name');

            await new Promise<void>((resolve, reject) => {
                req.login({id: userId, name},
                    (error) => error ? reject(error) : resolve());
            });

            assert(req.user, 'User came out wrong');
            assert(req.user.id === userId, 'User ID came out wrong');
            assert(req.user.name, 'User name came out wrong');

            res.redirect(playUri);
        }
        catch (error) {
            res.sendStatus(401);
            req.logout({keepSessionInfo: false}, () => undefined);
            throw error;
        }
    });
}
