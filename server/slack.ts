import assert  from 'node:assert';
import { App, ModalView, AckFn, ViewResponseAction, ViewOutput } from '@slack/bolt';
import { makeDebug } from './utility';
import { START_GAME, GAME_STARTED, RULES } from './slack-views';
import config, {off} from './config';
import { Rules } from './core';
import { TableBuilder } from './table-helper';
import GameRoom from './game-room';
import { Actions, Button, Message, Section, HomeTab, Header } from 'slack-block-builder';

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

    app.event('app_home_opened', async ({event, client}) => {
        debug('app home opened %j', event);
        if (event.tab === 'home') {
            client.views.publish({
                user_id: event.user,
                view:
                    HomeTab()
                        .callbackId('home-tab')
                        .blocks(
                            Header().text('Start a game'),
                            Actions()
                                .elements(
                                    Button()
                                        .actionId('home-start-game')
                                        .text('Click me!')
                                        .primary(true)
                                )
                        )
                        .buildToObject()
            })
        }
    });

    app.action({callback_id: 'home-tab'}, async ({body, ack}) => {
        debug('home-tab callback %j', body);
        ack();
    });

    app.action('home-start-game', async ({body, ack}) => {
        debug('home-start-game action %j', body);
        ack();
        if (body.type === 'block_actions') {
            app.client.views.open({
                trigger_id: body.trigger_id,
                view: START_GAME([]) as ModalView
            });
        }
    });

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

    app.shortcut('play-shortcut', async ({ shortcut, ack }) => {
        debug('play-shortcut');
        await ack();
        await app.client.views.open({
            trigger_id: shortcut.trigger_id,
            view: START_GAME([]) as ModalView
        });
    });

    app.action({callback_id: 'set-rules', }, async ({ack}) => {
        ack();
    });

    /** When the rules view is submitted */

    app.view({type: 'view_submission', callback_id: 'set-rules'},
        async ({ ack, view }) => {
            debug('state %j', view.state);
            debug('table', view.private_metadata);
            const table = TableBuilder.parse(view.private_metadata);
            createInvitation(ack, table, loadRulesFrom(view));
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

        const table = new TableBuilder();

        table.host = {id: body.user.id};

        /** Add the host to the set so they don't invite themselves */

        if (partners) {
            if (partners.length > 1) {
                return ack({
                    response_action: 'errors',
                    errors: {
                        ['partner-block']: 'You can only have one partner!'
                    }
                });
            }
            for (const id of partners) {
                if (table.has(id)) {
                    return ack({
                        response_action: 'errors',
                        errors: {
                            ['partner-block']: `It would be nice to be your own partner`
                        }
                    });
                }
                table.partner = {id};
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
            for (const id of team) {
                if (table.has(id)) {
                    return ack({
                        response_action: 'errors',
                        errors: {
                            ['team-block']: `You can't invite the same person twice`
                        }
                    });
                }
                table.addOther({id});
            }
        }

        if (table.has('USLACKBOT')) {
            return ack({
                response_action: 'errors',
                errors: {
                    ['team-block']: `Slackbot doesn't play 42...`
                }
            });
        }

        /** Get user info for everyone in the set */

        const infos = await Promise.all(table.ids
            .map((id) => client.users.info({user: id})));

        for (const info of infos) {
            if (info.user?.is_bot) {
                return ack({
                    response_action: 'errors',
                    errors: {
                        ['team-block']: `You can't invite a Slack bot`
                    }
                });
            }
            debug('info %j', info);
            const id = info.user?.id;
            const name = info.user?.profile?.real_name;
            if (id && name) {
                table.setName(id, name);
            }
        }

        /** Set the inputs in private metadata and open the rules view */

        return ack({
            response_action: 'push',
            view: RULES(JSON.stringify(table))
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
        ...value('renege'),
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
    table: TableBuilder,
    rules: Rules)
{
    const host = table.host;
    const ids = table.ids;

    assert(host, 'How can we not have a host');
    assert(ids.length > 0, 'No ids?');

    const room = new GameRoom(rules, table);

    /** The URL to play */

    const url = `${config.FT2_SERVER_BASE_URL}/slack/game/${room.token}`;

    /**
     * If it is just this user that wants to play with bots, we're going to
     * update the view and be done.
     */

    if (ids.length === 1) {
        return ack({
            response_action: 'push',
            view: GAME_STARTED(url)
        });
    }

    /**
     * Otherwise, there is at least one other human involved so we're
     * going to open up a direct message conversation between everyone
     */

    const conversation = await app.client.conversations.open({
        users: table.ids.join(',')
    });

    debug('conversation started: %j', conversation);

    const channel = conversation.channel?.id;

    assert(channel, 'conversation missing channel.id');

    /** Post an opening message to the channel */

    const text = `:face_with_cowboy_hat: <@${host.id}> wants to a play a game with y'all`;

    const playMessage = await app.client.chat.postMessage(
        Message({channel})
            .text(text)
            .blocks(
                Section().text(text),
                Actions().elements(
                    Button()
                        .primary(true)
                        .actionId('play-action')
                        .text('Play')
                        .url(url)
                )

            ).buildToObject()
    );

    const deleteMessage = () => {
        const { ts } = playMessage;
        if (ts) {
            app.client.chat.delete({channel, ts});
            debug('deleted play message for %j', table.table);
        }
    };

    /** 'Push' the next page of the modal - this is just visible to the host */

    ack({
        response_action: 'push',
        view: GAME_STARTED(url, channel)
    });

    /** Listen to events from the room */

    room.once('gameOver', ({save}) => {
        const score = save.score.join('-');
        const winners = save.winners.map((name) => {
            const id = room.table.idFor(name);
            return id ? `<@${id}>` : name;
        }).join(' and ');
        app.client.chat.postMessage(
            Message({channel})
                .text(`Congrats to ${winners} on a ${score} victory! :trophy:`)
                .buildToObject()
        );
        /** Delete the 'play' message */
        deleteMessage();
    });

    room.once('expired', () => {
        deleteMessage();
        app.client.chat.postMessage(
            Message({channel})
                .text('The game took too long to get started and expired :hourglass:')
                .buildToObject());
    });
}
