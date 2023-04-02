import assert from 'node:assert';
import _ from 'lodash';
import { Rules, Bone } from './core';
import GameDriver from './driver';
import { BasePlayer } from './base-player';
import RandomBot from './random-bot';
import PromptPlayer from './prompt-player';
import { FallbackStrategy, Forced, MoneyForPartner, NoMoneyOnUncertainLead, PassStrategy, PlayFirst, TakeTheLead, Trash, TryToKeepMyPartnersTrumps, UnbeatableLead, WinWithMoney } from './strategies';

const auto = process.argv[2] === 'auto';
let count = parseInt(process.argv[3] || '1', 10);

async function play(): Promise<void> {

    function pad(name: string) {
        return name.padEnd('partner'.length + 1, ' ');
    }

    const me = new PromptPlayer(pad('me'));
    me.debug.enabled = false;

    const partner = new RandomBot(pad('partner'), true).with(
        {
            name: 'show me',
            async play(player: BasePlayer, possible: Bone[]) {
                player.debug('remaining %o', Bone.toList(_.sortBy(player.remaining(player.bones), 'id')));
                player.debug('deep      %o', Bone.toList(_.sortBy(player.deepRemaining(), 'id')));
                const after = player.table?.after(player.lead?.from || player.name);
                assert(after);
                player.debug('after me %o', after);
                for (const name of after) {
                    player.debug('%s has %o', name.padEnd(15, ' '), Bone.toList(player.has(name)));
                }
                player.debug('i can play %o', Bone.toList(possible));
            }
        },
        Forced,
        PassStrategy,
        MoneyForPartner,
        TakeTheLead,
        TryToKeepMyPartnersTrumps,
        UnbeatableLead,
        NoMoneyOnUncertainLead,
        WinWithMoney,
        Trash,
        FallbackStrategy
    );

    const players = [
        me,
        new RandomBot(pad('left'), true).with(PassStrategy, PlayFirst),
        partner,
        new RandomBot(pad('right'), true).with(PassStrategy, PlayFirst),
    ];

    const mine = Bone.list(['3.0', '2.1', '0.0', '1.0', '6.0', '5.2', '4.1']);
    const p = Bone.list(['4.4', '6.4', '3.3', '3.1', '5.5', '1.1', '5.1']);
    const remaining = _.difference(Bone.ALL, mine, p);
    const bones = _.concat(mine, remaining.slice(0, 7), p, remaining.slice(7));

    const rules = new Rules(bones);

    const j = rules.toJson();
    console.log(j);
    console.log(Rules.fromJson(j));
    assert(Rules.fromJson(j).toJson() === j);

    return;

    return GameDriver.start(rules, players).then(() => {
        if (!auto) {
            console.log('\nDONE');
        }
        else if (count--) {
            console.log(count);
            return play();
        }
    });
}

play();
