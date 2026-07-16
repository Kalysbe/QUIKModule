import { describe, expect, it } from 'vitest';
import {
  matchesAuctionDate,
  toAuctionDateParam,
  toDateKey,
} from './auctionDate';

describe('toDateKey', () => {
  it('parses ISO date and datetime', () => {
    expect(toDateKey('2026-06-11')).toBe('2026-06-11');
    expect(toDateKey('2026-06-11T14:30:00')).toBe('2026-06-11');
  });

  it('parses YYYYMMDD', () => {
    expect(toDateKey('20260611')).toBe('2026-06-11');
  });

  it('parses DD.MM.YYYY', () => {
    expect(toDateKey('11.06.2026')).toBe('2026-06-11');
  });
});

describe('toAuctionDateParam', () => {
  it('converts TradeDate to YYYYMMDD', () => {
    expect(toAuctionDateParam('2026-06-11')).toBe('20260611');
  });
});

describe('matchesAuctionDate', () => {
  it('keeps items on the auction date', () => {
    expect(matchesAuctionDate('2026-06-11T10:00:00', '2026-06-11')).toBe(true);
  });

  it('drops items from other days', () => {
    expect(matchesAuctionDate('2026-06-10T23:00:00', '2026-06-11')).toBe(false);
  });

  it('does not filter when auction date is missing', () => {
    expect(matchesAuctionDate('2026-06-11T10:00:00', undefined)).toBe(true);
  });
});
