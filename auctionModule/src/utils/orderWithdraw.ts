import { toDateKey } from '@/utils/auctionDate';
import { isCancelledOrderState } from '@/utils/orderState';

/** Нормализует время суток к HH:MM:SS. */
export function normalizeTimeOfDay(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const match = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hh = String(Number(match[1])).padStart(2, '0');
  const mm = match[2];
  const ss = match[3] ?? '00';
  return `${hh}:${mm}:${ss}`;
}

/**
 * Нормализует дату-время к `YYYY-MM-DDTHH:MM:SS` (без TZ).
 * Поддерживает wall-clock строки от API и ISO с Z.
 */
export function toWallDateTimeKey(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;

  const wall = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (wall && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const hh = String(Number(wall[4])).padStart(2, '0');
    const ss = wall[6] ?? '00';
    return `${wall[1]}-${wall[2]}-${wall[3]}T${hh}:${wall[5]}:${ss}`;
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;

  // timestamp without time zone из QUIK хранится как локальное время Бишкека;
  // node-pg отдаёт его как UTC-сдвиг — восстанавливаем стеновое время.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(parsed);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  const y = get('year');
  const m = get('month');
  const d = get('day');
  let hh = get('hour');
  const mm = get('minute');
  const ss = get('second');
  if (!y || !m || !d || hh == null || !mm || ss == null) return null;
  // en-CA иногда даёт "24" для полуночи
  if (hh === '24') hh = '00';
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

/** Дата+время окончания аукциона: TradeDate + endtime. */
export function getAuctionEndDateTimeKey(
  tradeDate: string | null | undefined,
  endtime: string | null | undefined,
): string | null {
  const dateKey = toDateKey(tradeDate);
  const timeKey = normalizeTimeOfDay(endtime);
  if (!dateKey || !timeKey) return null;
  return `${dateKey}T${timeKey}`;
}

/**
 * WithdrawDateTime совпадает с датой/временем окончания аукциона
 * (с точностью до секунды).
 */
export function matchesAuctionEndDateTime(
  withdrawDateTime: string | null | undefined,
  tradeDate: string | null | undefined,
  endtime: string | null | undefined,
): boolean {
  const withdrawKey = toWallDateTimeKey(withdrawDateTime);
  const endKey = getAuctionEndDateTimeKey(tradeDate, endtime);
  if (!withdrawKey || !endKey) return false;
  return withdrawKey === endKey;
}

/** Снятая заявка, снятая ровно в момент окончания аукциона. */
export function isWithdrawnAtAuctionEnd(
  state: string | null | undefined,
  withdrawDateTime: string | null | undefined,
  tradeDate: string | null | undefined,
  endtime: string | null | undefined,
): boolean {
  const normalized = (state ?? '').toLowerCase();
  if (!normalized.includes('снят')) return false;
  if (!isCancelledOrderState(state)) return false;
  return matchesAuctionEndDateTime(withdrawDateTime, tradeDate, endtime);
}
