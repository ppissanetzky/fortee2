
import type { Express } from 'express';
import passport, { session } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import { makeDebug } from './utility';
import config from './config';

const debug = makeDebug('server').extend('auth');

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

export default function setupAuthentication(app: Express): void {

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

    /**
     * The strategy
     */

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
        }
    ));

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
            // Successful authentication, redirect
            res.redirect('/login-done');
        }
    );

    /**
     * This one takes the user from
     * session.passport.user and deserializes it, placing the result in req.user
     */

    app.use(passport.authenticate('session'));

    /**
     * Just to get the redirect to succeed
     */

    app.get('/login-done', (req, res) => {
        debug('user', req.user);
        debug('session', req.session);
        res.sendStatus(200);
    });

    /**
     * This one will only allow requests that have a user, otherwise it's a 401
     */

    app.use((req, res, next) => {
        if (req.user) {
            return next();
        }
        res.sendStatus(401);
    });
}

//-----------------------------------------------------------------------------

//

