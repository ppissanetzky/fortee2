import assert from 'node:assert';
import _ from 'lodash';
import { Rules, Bone } from './core';
import GameDriver from './driver';
import Bot from './bot';
import PromptPlayer from './prompt-player';
import { Fallback, MoneyForPartner, NoMoneyOnUncertainLead,
    Pass, PlayFirst, TakeTheLead, Trash, KeepPartnerTrumps,
    UnbeatableLead, WinWithMoney } from './strategies';
import Strategy from './strategy';

const auto = process.argv[2] === 'auto';
let count = parseInt(process.argv[3] || '1', 10);

async function play(): Promise<void> {

    function pad(name: string) {
        return name.padEnd('partner'.length + 1, ' ');
    }

    const strategies = [
        Pass,
        MoneyForPartner,
        TakeTheLead,
        KeepPartnerTrumps,
        UnbeatableLead,
        NoMoneyOnUncertainLead,
        WinWithMoney,
        Trash,
        Fallback
    ];

    const me = new PromptPlayer(pad('me'));

    const partnerDebug = new Strategy('debug', {
        play({name, debug, remaining, table, lead, has, possible}) {
            debug('remaining  %o', Bone.toList(_.sortBy(remaining, 'id')));
            const after = table.after(lead?.from || name);
            debug('after me   %o', after);
            for (const name of after) {
                debug('%s has %o', name.padEnd(15, ' '), Bone.toList(has(name)));
            }
            debug('i can play %o', Bone.toList(possible));
        }
    });



    const partner = new Bot(pad('partner'), true).with(
        partnerDebug,
        ...strategies
    );

    const players = [
        me,
        new Bot(pad('left'), true).with(...strategies),
        partner,
        new Bot(pad('right'), true).with(...strategies),
    ];

    const mine = Bone.list(['3.0', '2.1', '0.0', '1.0', '6.0', '5.2', '4.1']);
    const p = Bone.list(['4.4', '6.4', '3.3', '3.1', '5.5', '1.1', '5.1']);
    const remaining = _.difference(Bone.ALL, mine, p);
    const bones = _.concat(mine, remaining.slice(0, 7), p, remaining.slice(7));

    const rules = new Rules(bones);

    // const j = rules.toJson();
    // console.log(j);
    // console.log(Rules.fromJson(j));
    // assert(Rules.fromJson(j).toJson() === j);

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
