import Bot from './bot';
import { Fallback, MoneyForPartner,
    NoMoneyOnUncertainLead, Pass,
    TakeTheLead, Trash, KeepPartnerTrumps,
    UnbeatableLead,
    WinWithMoney} from './strategies';

export default class ProductionBot extends Bot {
    constructor() {
        super();
        this.with(
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
