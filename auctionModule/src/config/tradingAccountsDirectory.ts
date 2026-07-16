/**
 * Локальный справочник «Торговый счёт» / «Код клиента» для выгрузки .tri файлов.
 *
 * Раньше значения были зашиты константами прямо в коде выгрузки (allocation.ts).
 * Теперь они берутся отсюда — по коду класса инструмента (ClassCode).
 * Сами данные справочника вынесены в tradingAccountsDirectory.config.ts.
 */
import type { TradingAccountEntry } from './tradingAccountEntry.types';
import {
  DEFAULT_TRADING_ACCOUNT_ENTRY,
  TRADING_ACCOUNTS_DIRECTORY,
} from './tradingAccountsDirectory.config';

export type { TradingAccountEntry };
export { DEFAULT_TRADING_ACCOUNT_ENTRY, TRADING_ACCOUNTS_DIRECTORY };

/**
 * Возвращает торговый счёт и код клиента для указанного ClassCode.
 * Если запись в справочнике не найдена — возвращает значение по умолчанию.
 */
export function resolveTradingAccountEntry(classCode?: string | null): TradingAccountEntry {
  if (!classCode) return DEFAULT_TRADING_ACCOUNT_ENTRY;
  const key = classCode.trim().toUpperCase();
  return TRADING_ACCOUNTS_DIRECTORY[key] ?? DEFAULT_TRADING_ACCOUNT_ENTRY;
}
