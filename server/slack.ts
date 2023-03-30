import assert  from 'node:assert';
import { App, ModalView } from '@slack/bolt';
import { makeDebug } from './utility';
import { START_GAME, PLAY_DM, GAME_STARTED } from './slack-views';
import config from './config';
import { InvitationInputs, Invitation } from './invitations';

const debug = makeDebug('slack');

export default async function connectToSlack() {

    if (config.FT2_SLACK_ON !== 'yes') {
        debug('not connecting to Slack');
        return;
    }

    const app = new App({
        token: config.FT2_SLACK_BOT_TOKEN,
        socketMode: true,
        appToken: config.FT2_SLACK_APP_TOKEN,
    });

    app.command('/play', async ({ command, ack, respond }) => {
        debug('/play', command);
        await ack();
        await app.client.views.open({
            trigger_id: command.trigger_id,
            view: START_GAME as ModalView,
        });
    });

    /** A user clicked 'Play' on an invitation ephemeral */

    app.action('play-action', async ({ack, body}) => {
        debug('play-action', JSON.stringify(body));
        await ack();
    });

    /** When the 'Start Game' form is submitted */

    app.view({type: 'view_submission', callback_id: 'start-game'},
        async ({ ack, body, view, client, logger, respond }) => {
        // {
        //     "values": {
        //         "partner-block": {
        //             "partner": {
        //                 "type": "multi_users_select",
        //                 "selected_users": [
        //                     "U050GB33RDZ"
        //                 ]
        //             }
        //         },
        //         "team-block": {
        //             "team": {
        //                 "type": "multi_users_select",
        //                 "selected_users": [
        //                     "U050B8167TP",
        //                     "U050SUU8SV7"
        //                 ]
        //             }
        //         }
        //     }
        // }
        debug('view state : %j', view.state);

        const partners = view.state.values['partner-block']['partner'].selected_users;
        const team = view.state.values['team-block']['team'].selected_users;

        const inputs: InvitationInputs = {
            host: body.user.id,
            partner: '',
            team: [] as string[],
            names: new Map<string, string>()
        };

        /** Add the host to the set so they don't invite themselves */

        // PUT IT BACK

        const set = new Set<string>([/*inputs.host*/]);

        if (partners) {
            if (partners.length > 1) {
                return ack({
                    response_action: 'errors',
                    errors: {
                        ['partner-block']: 'You can only have one partner!'
                    }
                });
            }
            for (const user of partners) {
                if (set.has(user)) {
                    return ack({
                        response_action: 'errors',
                        errors: {
                            ['partner-block']: `It would be nice to be your own partner`
                        }
                    });
                }
                inputs.partner = user;
                set.add(user);
            }
        }
        if (team) {
            if (team.length > 2) {
                return ack({
                    response_action: 'errors',
                    errors: {
                        ['team-block']: 'Do you really want that many people in the other team?'
                    }
                });
            }
            for (const user of team) {
                if (set.has(user)) {
                    return ack({
                        response_action: 'errors',
                        errors: {
                            ['team-block']: `You can't invite the same person twice`
                        }
                    });
                }
                inputs.team.push(user);
                set.add(user);
            }
        }

        if (set.has('USLACKBOT')) {
            return ack({
                response_action: 'errors',
                errors: {
                    ['team-block']: `Slackbot doesn't play 42...`
                }
            });
        }

        // REMOVE
        set.add(inputs.host);

        /** Get user info for everyone in the set */

        const infos = await Promise.all(Array.from(set.values())
            .map((user) => client.users.info({user})));

        for (const info of infos) {
            /** TODO, will check later once we have more real humans */
            // if (info.user?.is_bot) {
            // }
            const id = info.user?.id;
            const name = info.user?.profile?.display_name
                || info.user?.profile?.real_name;
            if (id && name) {
                inputs.names.set(id, name);
            }
        }

        /** Create the invitation and send the initial messages */

        const invitation = new Invitation(inputs);

        invitation.onceExpired.then(() => {
            // TODO - update/delete messages
        });

        /**
         * If it is just this user that wants to play with bots, we're going to
         * update the view and be done.
         */

        if (invitation.users.length === 1) {
            return ack({
                response_action: 'push',
                view: GAME_STARTED(inputs.host, '', invitation)
            });
        }

        /**
         * Otherwise, there is at least one other human involved so we're
         * going to open up a direct message conversation between everyone
         */

        const conversation = await client.conversations.open({
            users: invitation.users.join(',')
        });

        debug('conversation started: %j', conversation);

        const channel = conversation.channel?.id;

        assert(channel, 'conversation missing channel.id');

        /** Post an opening message to the channel */

        await client.chat.postMessage({
            channel,
            text: `:face_with_cowboy_hat: <@${invitation.host}> wants to a play a game with y'all`
        });

        /** 'Push' the second page of the modal */

        ack({
            response_action: 'push',
            view: GAME_STARTED(inputs.host, channel, invitation)
        });

        /** Post an ephemeral to each user */

        for (const user of invitation.users) {
            const result = await client.chat.postEphemeral({
                channel,
                user,
                blocks: PLAY_DM(user, invitation),
                text: `<@${inputs.host}> has invited you to play a game!`
            });
            debug('posted ephemeral', JSON.stringify(result));
        }
    });

    debug('Connecting...');
    await app.start();
    debug('Connected');
}
