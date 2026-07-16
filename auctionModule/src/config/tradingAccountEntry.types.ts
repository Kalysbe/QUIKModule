export interface TradingAccountEntry {
  /** Торговый счёт, который проставляется в .tri файл (поле "Торговый счет"). */
  tradingAccount: string;
  /** Код клиента, который проставляется в .tri файл (поле "Комментарий"). */
  clientCode: string;
}
