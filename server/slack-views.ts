import type GameRoom from './game-room';
import { Button, Modal, Option, Section, setIfTruthy,
	StaticMultiSelect, StaticSelect } from 'slack-block-builder';

export function GAME_STARTED(room: GameRoom, channel?: string) {
    return Modal()
        .title('Your game is ready!')
        .notifyOnClose(false)
        .clearOnClose(true)
        .blocks(
            setIfTruthy(channel,
                Section()
                    .text(`I started a new chat with <#${channel}>`),
            ),
            Section()
                .text('To join the game, just click Play')
                .accessory(
                    Button()
                        .text('Play')
                        .primary(true)
                        .actionId('play-action')
                        .url(room.url)
                )
        ).buildToObject();
}

export function RULES(metadata: string) {
	return Modal()
	.callbackId('set-rules')
	.submit('Submit')
	.close('Back')
	.title('Set the rules')
	.clearOnClose(false)
	.privateMetaData(metadata)
	.blocks(
		// Section()
		// 	.blockId('reset')
		// 	.text('Reset to default values')
		// 	.accessory(
		// 		Button()
		// 			.actionId('reset-rules')
		// 			.text('Reset')
		// 	),
		Section()
			.blockId('min_bid')
			.text('What is the minimum bid?')
			.accessory(
				StaticSelect({actionId: 'min_bid'})
					.initialOption(
						Option({value: '30', text: '30'}))
					.options(
						Option({value: '30', text: '30'}),
						Option({value: '31', text: '31'}),
						Option({value: '32', text: '32'}),
						Option({value: '33', text: '33'}),
						Option({value: '34', text: '34'}),
						Option({value: '35', text: '35'}),
						Option({value: '36', text: '36'}),
						Option({value: '37', text: '37'}),
						Option({value: '38', text: '38'}),
						Option({value: '39', text: '39'}),
						Option({value: '40', text: '40'}),
						Option({value: '41', text: '41'}),
						Option({value: '1-mark', text: '1-mark'}),
					)
			),
		Section()
			.blockId('all_pass')
			.text('When everyone passes?')
			.accessory(
				StaticSelect({actionId: 'all_pass'})
				.initialOption(
					Option({value: 'FORCE', text: 'Force a bid' }))
				.options(
					Option({value: 'FORCE', text: 'Force a bid'}),
					Option({value: 'SHUFFLE', text: 'Reshuffle'})
				)
			),
		Section()
			.blockId('forced_min_bid')
			.text('What is the bid when stuck?')
			.accessory(
				StaticSelect({actionId: 'forced_min_bid'})
					.initialOption(
						Option({value: '30', text: '30'}))
					.options(
						Option({value: '30', text: '30'}),
						Option({value: '31', text: '31'}),
						Option({value: '32', text: '32'}),
						Option({value: '33', text: '33'}),
						Option({value: '34', text: '34'}),
						Option({value: '35', text: '35'}),
						Option({value: '36', text: '36'}),
						Option({value: '37', text: '37'}),
						Option({value: '38', text: '38'}),
						Option({value: '39', text: '39'}),
						Option({value: '40', text: '40'}),
						Option({value: '41', text: '41'}),
						Option({value: '1-mark', text: '1-mark'}),
					)
			),
		Section()
			.blockId('follow_me_doubles')
			.text('When playing follow-me, what are doubles?')
			.accessory(
				StaticMultiSelect({actionId: 'follow_me_doubles'})
					.initialOptions(
						Option({value: 'HIGH', text: 'High'}))
					.options(
						Option({value: 'HIGH_SUIT', text: 'High in their own suit'}),
						Option({value: 'LOW_SUIT', text: 'Low in their own suit' }),
						Option({value: 'HIGH', text: 'High' }),
						Option({value: 'LOW', text: 'Low'})
					)
			),
		Section()
			.blockId('plunge_allowed')
			.text('Allow Plunge?')
			.accessory(
				StaticSelect({actionId: 'plunge_allowed'})
					.initialOption(
						Option({value: 'NO', text: 'No'}))
					.options(
						Option({value: 'YES', text: 'Yes'}),
						Option({value: 'NO', text: 'No'})
					)
			),
		Section()
			.blockId('plunge_min_marks')
			.text('How many marks to Plunge')
			.accessory(
				StaticSelect({actionId: 'plunge_min_marks'})
					.initialOption(
						Option({value: '2', text: '2'}))
					.options(
						Option({value: '1', text: '1'}),
						Option({value: '2', text: '2'}),
						Option({value: '3', text: '3'}),
						Option({value: '4', text: '4'}),
						Option({value: '5', text: '5'}),
					)
		),
		Section()
			.blockId('plunge_max_marks')
			.text('Most marks on Plunge')
			.accessory(
				StaticSelect({actionId: 'plunge_max_marks'})
					.initialOption(
						Option({value: '2', text: '2'}))
					.options(
						Option({value: '1', text: '1'}),
						Option({value: '2', text: '2'}),
						Option({value: '3', text: '3'}),
						Option({value: '4', text: '4'}),
						Option({value: '5', text: '5'}),
					)
		),
		Section()
			.blockId('sevens_allowed')
			.text('Allow Sevens?')
			.accessory(
				StaticSelect({actionId: 'sevens_allowed'})
					.initialOption(
						Option({value: 'NO', text: 'No'}))
					.options(
						Option({value: 'YES', text: 'Yes'}),
						Option({value: 'NO', text: 'No'})
					)
			),
		Section()
			.blockId('nello_allowed')
			.text('Allow Nello?')
			.accessory(
				StaticSelect({actionId: 'nello_allowed'})
					.initialOption(
						Option({value: 'NEVER', text: 'Never'}))
					.options(
						Option({value: 'NEVER', text: 'Never'}),
						Option({value: 'FORCE', text: 'Only when you are stuck'}),
						Option({value: 'ALWAYS', text: 'Any time'})
					)
			),
		Section()
			.blockId('nello_doubles')
			.text('When playing Nello, what are doubles?')
			.accessory(
				StaticMultiSelect({actionId: 'nello_doubles'})
					.initialOptions(
						Option({value: 'HIGH_SUIT', text: 'High in their own suit'}))
					.options(
						Option({value: 'HIGH_SUIT', text: 'High in their own suit'}),
						Option({value: 'LOW_SUIT', text: 'Low in their own suit'}),
						Option({value: 'HIGH', text: 'High'}),
						Option({value: 'LOW', text: 'Low'})
					)
			)
	)
	.buildToObject();
}

export function START_GAME(users: string[]) {
	const [partner, second, third] = users;
	const team = third ? [second, third] :
		(second ? [second] : undefined);
	return {
		type: 'modal',
		callback_id: 'start-game',
		submit: {
			type: 'plain_text',
			text: 'Invite'
		},
		title: {
			type: 'plain_text',
			text: `Let's get a game going`
		},
		blocks: [
			{
				"type": "input",
				"block_id": "partner-block",
				"optional": true,
				"element": {
					"type": "multi_users_select",
					"placeholder": {
						"type": "plain_text",
						"text": "Choose your partner",
						"emoji": true
					},
					"action_id": "partner",
					"max_selected_items": 1,
					"initial_users": partner ? [partner] : undefined,
				},
				"label": {
					"type": "plain_text",
					"text": "Who will be your partner?",
					"emoji": true
				}
			},
			{
				"type": "input",
				"block_id": "team-block",
				"optional": true,
				"element": {
					"type": "multi_users_select",
					"placeholder": {
						"type": "plain_text",
						"text": "Choose the other team",
						"emoji": true
					},
					"action_id": "team",
					"max_selected_items": 2,
					"initial_users": team
				},
				"label": {
					"type": "plain_text",
					"text": "Who will be on the other team?",
					"emoji": true
				}
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": "_If you want to play with bots, you can leave all the users blank._"
				}
			}
		]
	};
}
