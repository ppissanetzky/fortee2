import Bot from './bot';
import { Bid1, Fallback, MoneyForPartner,
    NoMoneyOnUncertainLead, Pass,
    TakeTheLead, Trash, KeepPartnerTrumps,
    UnbeatableLead,
    WinWithMoney} from './strategies';

export default class ProductionBot extends Bot {
    constructor(name?: string) {
        super(name);
        this.with(
            Bid1,
            Pass,
            MoneyForPartner,
            TakeTheLead,
            KeepPartnerTrumps,
            UnbeatableLead,
            NoMoneyOnUncertainLead,
            WinWithMoney,
            Trash,
            Fallback
        );
    }
}
