import type { TradingAccountEntry } from './tradingAccountEntry.types';

/**
 * Данные локального справочника «Торговый счёт» / «Код клиента».
 *
 * Как добавить/изменить запись:
 *   1. Найдите ClassCode нужного класса аукциона (см. страницу аукциона или таблицу quik_class_registry).
 *   2. Добавьте/поправьте строку в TRADING_ACCOUNTS_DIRECTORY ниже.
 *   3. Если для класса нет отдельной записи — используется DEFAULT_TRADING_ACCOUNT_ENTRY.
 */

/** Значение по умолчанию — используется, если для ClassCode нет записи в справочнике. */
export const DEFAULT_TRADING_ACCOUNT_ENTRY: TradingAccountEntry = {
  tradingAccount: '1-3301-22',
  clientCode: 'Minfin',
};

/**
 * Справочник: ClassCode -> { tradingAccount, clientCode }.
 * Ключи храним в верхнем регистре, сравнение по ClassCode регистронезависимое.
 */
export const TRADING_ACCOUNTS_DIRECTORY: Record<string, TradingAccountEntry> = {
  // Пример: 'GKO': { tradingAccount: '1-3301-68', clientCode: '2001' },
};
