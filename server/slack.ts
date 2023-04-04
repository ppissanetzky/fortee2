import assert  from 'node:assert';
import { App, ModalView, AckFn, ViewResponseAction, ViewOutput } from '@slack/bolt';
import { makeDebug } from './utility';
import { START_GAME, PLAY_DM, GAME_STARTED, RULES } from './slack-views';
import config, {off} from './config';
import { InvitationInputs, Invitation } from './invitations';
import { Rules } from './core';

const debug = makeDebug('slack');

const app = new App({
    token: config.FT2_SLACK_BOT_TOKEN,
    socketMode: true,
    appToken: config.FT2_SLACK_APP_TOKEN,
});

export default async function connectToSlack() {

    if (off(config.FT2_SLACK_ON)) {
        debug('not connecting to Slack');
        return;
    }

    app.command('/play', async ({ command, ack }) => {
        debug('/play', command);
        await ack();
        /** Gather up all the user IDs entered after "/play" */
        const users = [...command.text.matchAll(/<@([^|>]+)[|>]/g)]
            .map(([,item]) => item);
        await app.client.views.open({
            trigger_id: command.trigger_id,
            view: START_GAME(users) as ModalView,
        });
    });

    app.action({callback_id: 'set-rules', }, async ({ack}) => {
        ack();
    });

    /** When the rules view is submitted */

    app.view({type: 'view_submission', callback_id: 'set-rules'},
        async ({ ack, view }) => {
            debug('state %j', view.state);
            const inputs = JSON.parse(view.private_metadata) as InvitationInputs;
            assert(inputs);
            debug('inputs %j', inputs);
            createInvitation(ack, inputs, loadRulesFrom(view));
        }
    );

    /** A user clicked 'Play' on an invitation ephemeral */

    app.action('play-action',
        async ({ack, body}) => {
            debug('play-action %j', body);
            await ack();
        }
    );

    /** When the 'Start Game' form is submitted */

    app.view({type: 'view_submission', callback_id: 'start-game'},
        async ({ ack, body, view, client }) => {
        debug('view state : %j', view.state);

        const partners = view.state.values['partner-block']['partner'].selected_users;
        const team = view.state.values['team-block']['team'].selected_users;

        const inputs: InvitationInputs = {
            host: body.user.id,
            partner: '',
            team: [] as string[],
            names: {} as Record<string, string>
        };

        /** Add the host to the set so they don't invite themselves */

        const set = new Set<string>([inputs.host]);

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
                inputs.names[id] = name;
            }
        }

        /** Set the inputs in private metadata and open the rules view */

        return ack({
            response_action: 'push',
            view: RULES(inputs)
        });
    });

    debug('Connecting...');
    await app.start();
    debug('Connected');
}

function loadRulesFrom(view: ViewOutput): Rules {
    const {state: {values}} = view;
    function value(name: keyof Rules) {
        let result;
        const v = values[name][name];
        if (v.selected_options) {
            result = v.selected_options.map(({value}) => value)
        }
        else if (v.selected_option) {
            result = v.selected_option?.value
        }
        assert(result, `No value for "${name}"`);
        return {
            [name]: result
        }
    }
    return Rules.fromJson(JSON.stringify({
        ...value('min_bid'),
        ...value('all_pass'),
        ...value('forced_min_bid'),
        ...value('follow_me_doubles'),
        ...value('plunge_allowed'),
        ...value('plunge_min_marks'),
        ...value('plunge_max_marks'),
        ...value('sevens_allowed'),
        ...value('nello_allowed'),
        ...value('nello_doubles')
    }));
}

async function createInvitation(
    ack: AckFn<ViewResponseAction> | AckFn<void>,
    inputs: InvitationInputs,
    rules: Rules)
{
    const invitation = new Invitation(inputs, rules);

    const host = invitation.host;

    /**
     * If it is just this user that wants to play with bots, we're going to
     * update the view and be done.
     */

    if (invitation.users.length === 1) {
        return ack({
            response_action: 'push',
            view: GAME_STARTED(host, '', invitation)
        });
    }

    /**
     * Otherwise, there is at least one other human involved so we're
     * going to open up a direct message conversation between everyone
     */

    const conversation = await app.client.conversations.open({
        users: invitation.users.join(',')
    });

    debug('conversation started: %j', conversation);

    const channel = conversation.channel?.id;

    assert(channel, 'conversation missing channel.id');

    /** Post an opening message to the channel */

    await app.client.chat.postMessage({
        channel,
        text: `:face_with_cowboy_hat: <@${host}> wants to a play a game with y'all`
    });

    /** 'Push' the second page of the modal */

    ack({
        response_action: 'push',
        view: GAME_STARTED(host, channel, invitation)
    });

    /** Post an ephemeral to each user */

    for (const user of invitation.users) {
        const result = await app.client.chat.postEphemeral({
            channel,
            user,
            blocks: PLAY_DM(user, invitation),
            text: `<@${host}> has invited you to play a game!`
        });
        debug('posted ephemeral', JSON.stringify(result));
    }

    /** Listen to events from the invitation */

    invitation.on('gameOver', ({bots, save}) => {
        if (bots > 0) {
            return;
        }
        const score = save.score.join('-');
        const winners = save.winners.map((name) =>
            `<@${invitation.userIdForName(name)}>`).join(' and ');
        app.client.chat.postMessage({
            channel,
            text: `Congrats to ${winners} on a ${score} victory! :trophy:`
        });
    });
}
