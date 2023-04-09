import path from 'node:path';
import assert from 'node:assert';

import fetch from 'node-fetch';
import type { Express } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Strategy as LocalStrategy } from 'passport-local';
import sqlite from 'better-sqlite3';
import ms from 'ms';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Store = require('better-sqlite3-session-store')(session);

import { makeDebug, hashString } from './utility';
import config from './config';

const debug = makeDebug('server').extend('auth');

/**
 * The shape of our Express user
 */

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface User {
            id: string;
            name: string;
        }
    }
}

/**
 * See https://developers.google.com/identity/gsi/web/guides/overview
 *
 * This is the strategy called 'google'. When someone presses the
 * "sign in with Google button", Google will compose a request and
 * post it to the "data-login_uri" configured on the web page. We have it set
 * to /google-login.
 *
 * The express handler post('/google-login') will then verify it and reply
 * to Google with the "callbackURL" (I think).
 *
 * Google then calls the the callbackURL with a GET request including the
 * profile information for the user. This is get('/google-login') and that
 * invokes the strategie's callback, where we have access to the user's
 * Google profile.
 */

function google(app: Express): void {

    if (config.PRODUCTION) {
        return;
    }

    passport.use(new GoogleStrategy({
        clientID: config.FT2_GSI_CLIENT_ID,
        clientSecret: config.FT2_GSI_SECRET,
        callbackURL: '/google-login'
    },
    (accessToken, refreshToken, profile, cb) => {
        try {
            debug('google profile', JSON.stringify(profile));
            const user = {
                id: `${profile.provider}/${profile.id}`,
                name: profile.displayName,
            };
            cb(null, user);
        }
        catch (error) {
            cb(error as Error);
        }
    }));

    /**
     * Called by Google with 'credential' in the body. Passport does all the
     * verification and then replies to Google, telling them to go to
     * 'callbackUrl' with the profile.
     */

    app.post('/google-login',
        passport.authenticate('google', {scope: ['email', 'profile']})
    );

    /**
     * This is 'callbackUrl', which is called by Google. Passport then invokes
     * the strategy's calback above with the Google user's profile information.
     * We convert that to a user object and return it. Passport then serializes
     * it and puts it in req.session.passport.user. The deserialized version
     * gets attached to req.user.
     */

    app.get('/google-login',
        passport.authenticate('google', {session: true, failureRedirect: '/getin'}),
        (req, res) => {
            debug('user', req.user);
            debug('session', req.session);
            /**
             * Successful authentication, redirect
             * During development, you will get a 404 because the redirect
             * goes to the server port, but the session cookie is there and
             * you can refresh /
             */
            res.redirect('/');
        }
    );
}

function local(app: Express): void {

    if (config.PRODUCTION) {
        return;
    }

    passport.use(new LocalStrategy(
        (name: string, password: string, cb) => {
            if (password !== config.FT2_LOCAL_PASSWORD) {
                return cb(null);
            }
            cb(null, {
                /**
                 * Use a hash of the name, so the ID corresponds to it
                 * and no user can connect with the same ID.
                 */
                id: `local/${hashString(name.toLowerCase())}`,
                name: name
            });
        }
    ));

    app.post('/api/local-login',
        (req, res, next) => {
            debug('local login with', req.body);
            next();
        },
        passport.authenticate('local'),
        (req, res) => {
            debug('user', req.user);
            res.sendStatus(200);
        });
}

export default function setupAuthentication(app: Express): void {

    app.use(session({
        name: config.FT2_SESSION_COOKIE_NAME,
        secret: config.FT2_SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
        proxy: config.PRODUCTION ? false : true,
        cookie: {
            secure: config.PRODUCTION ? true : false,
            httpOnly: true,
            path: '/',
            /** Using 'strict' breaks sign-in-with-slack */
            sameSite: 'lax'
        },
        store: new Store({
            client: new sqlite(path.join(config.FT2_DB_PATH, 'sessions.db')),
            expired: {
              clear: true,
              intervalMs: ms('15m')
            }
        })
    }));

    /**
     * This one is called when a new user object is returned by the strategy's
     * callback. It is meant to serialize that into session.passport.user
     */

    passport.serializeUser((user, done) => done(null, user));

    /**
     * This one is called to take session.passport.user and put the result
     * in req.user
     */

    passport.deserializeUser((user: Express.User, done) => done(null, user));


    google(app);
    local(app);

    passport.use(new OAuth2Strategy({
            authorizationURL: 'https://discord.com/oauth2/authorize',
            tokenURL: 'https://discord.com/api/oauth2/token',
            clientID: config.FT2_DD_APP_ID,
            clientSecret: config.FT2_DD_APP_SECRET,
            callbackURL: `${config.FT2_SERVER_BASE_URL}/discord/authenticated`,
            scope: ['email'],
        },
        async (accessToken: string, refreshToken: string, profile, TProfile, callback) => {

            try {
                const response = await fetch('https://discord.com/api/v10/users/@me', {
                    headers: {
                        ['User-Agent']: `DiscordBot (${config.FT2_SERVER_BASE_URL}, ${config.version})`,
                        ['Authorization']: `Bearer ${accessToken}`
                    }
                });
                assert(response.ok, `request for user info failed with ${response.status}`);
                const me = await response.json();
                debug.extend('discord')('me %j', me);
                const user = {
                    id: `discord/${me.id}`,
                    name: me.username,
                };
                debug.extend('discord')('user %j', user);
                callback(null, user);
            }
            catch (error) {
                callback(error as any);
            }
        }
    ));

    /**
     * Just to get the redirect to succeed
     */

    app.get('/login-done', (req, res) => {
        debug('user', req.user);
        debug('session', req.session);
        res.sendStatus(200);
    });
}

//-----------------------------------------------------------------------------

//

