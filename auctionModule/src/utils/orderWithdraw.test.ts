import { describe, expect, it } from 'vitest';
import {
  getAuctionEndDateTimeKey,
  isWithdrawnAtAuctionEnd,
  matchesAuctionEndDateTime,
  normalizeTimeOfDay,
  toWallDateTimeKey,
} from '@/utils/orderWithdraw';

describe('orderWithdraw', () => {
  it('normalizes time of day', () => {
    expect(normalizeTimeOfDay('17:00:00')).toBe('17:00:00');
    expect(normalizeTimeOfDay('9:05')).toBe('09:05:00');
    expect(normalizeTimeOfDay('1900-01-01T17:40:00')).toBe('17:40:00');
  });

  it('builds auction end key from TradeDate + endtime', () => {
    expect(getAuctionEndDateTimeKey('2026-07-17', '17:00:00')).toBe(
      '2026-07-17T17:00:00',
    );
    expect(getAuctionEndDateTimeKey('20260717', '17:00')).toBe(
      '2026-07-17T17:00:00',
    );
    expect(getAuctionEndDateTimeKey('2026-07-17', null)).toBeNull();
  });

  it('parses wall-clock WithdrawDateTime from API as-is', () => {
    expect(toWallDateTimeKey('2026-07-17T17:00:00')).toBe('2026-07-17T17:00:00');
    expect(toWallDateTimeKey('2026-07-17 17:00:00')).toBe('2026-07-17T17:00:00');
  });

  it('matches withdraw at auction end', () => {
    expect(
      matchesAuctionEndDateTime('2026-07-17T17:00:00', '2026-07-17', '17:00:00'),
    ).toBe(true);
    expect(
      matchesAuctionEndDateTime('2026-07-17T16:59:59', '2026-07-17', '17:00:00'),
    ).toBe(false);
  });

  it('includes only «Снята» at auction end', () => {
    expect(
      isWithdrawnAtAuctionEnd(
        'Снята',
        '2026-07-17T17:00:00',
        '2026-07-17',
        '17:00:00',
      ),
    ).toBe(true);
    expect(
      isWithdrawnAtAuctionEnd(
        'Снята',
        '2026-07-17T07:39:11',
        '2026-07-17',
        '17:00:00',
      ),
    ).toBe(false);
    expect(
      isWithdrawnAtAuctionEnd(
        'Отменена',
        '2026-07-17T17:00:00',
        '2026-07-17',
        '17:00:00',
      ),
    ).toBe(false);
    expect(
      isWithdrawnAtAuctionEnd(
        'Активна',
        '2026-07-17T17:00:00',
        '2026-07-17',
        '17:00:00',
      ),
    ).toBe(false);
  });
});
