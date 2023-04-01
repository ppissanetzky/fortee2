import { BasePlayer } from './base-player';
import { FallbackStrategy, Forced, MoneyForPartner,
    NoMoneyOnUncertainLead, PassStrategy,
    TakeTheLead, Trash, TryToKeepMyPartnersTrumps,
    UnbeatableLead,
    WinWithMoney} from './strategies';

export default function bestBot(player: BasePlayer): BasePlayer {
    return player.with(
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
    )
}
