import { describe, expect, it } from 'vitest';
import type { Auction } from '@/types/auction';
import {
  computeWeightedAveragePriceFromOrders,
  enrichAuctionsWithOrderWaPrice,
} from './enrichAuctionsWaPrice';

describe('computeWeightedAveragePriceFromOrders', () => {
  it('weights price by quantity', () => {
    const wa = computeWeightedAveragePriceFromOrders([
      { price: 90, quantity: 100 },
      { price: 95, quantity: 300 },
    ]);
    expect(wa).toBeCloseTo((90 * 100 + 95 * 300) / 400, 4);
  });

  it('ignores non-competitive and empty qty', () => {
    expect(
      computeWeightedAveragePriceFromOrders([
        { price: 0, quantity: 500 },
        { price: 91, quantity: 0 },
      ]),
    ).toBeNull();
  });
});

describe('enrichAuctionsWithOrderWaPrice', () => {
  it('sets waprice from matching buy orders', () => {
    const auctions: Auction[] = [
      {
        ClassCode: 'AUCT',
        SecCode: 'GCB001',
        TradeDate: '2026-07-16',
        waprice: '0',
      },
    ];

    const enriched = enrichAuctionsWithOrderWaPrice(auctions, [
      {
        ClassCode: 'AUCT',
        SecCode: 'GCB001',
        Price: '90',
        Qty: '100',
        Value: '9000',
        OrderDateTime: '2026-07-16T10:00:00',
        Operation: 'Купля',
        State: 'Активна',
      },
      {
        ClassCode: 'AUCT',
        SecCode: 'GCB001',
        Price: '95',
        Qty: '300',
        Value: '28500',
        OrderDateTime: '2026-07-16T11:00:00',
        Operation: 'Купля',
        State: 'Активна',
      },
      {
        ClassCode: 'AUCT',
        SecCode: 'GCB001',
        Price: '99',
        Qty: '50',
        Value: '4950',
        OrderDateTime: '2026-07-15T11:00:00',
        Operation: 'Купля',
        State: 'Активна',
      },
    ]);

    expect(Number(enriched[0].waprice)).toBeCloseTo(
      (90 * 100 + 95 * 300) / 400,
      4,
    );
  });

  it('keeps original waprice when no competitive orders', () => {
    const auctions: Auction[] = [
      { SecCode: 'GCB002', TradeDate: '2026-07-16', waprice: '88.5' },
    ];
    const enriched = enrichAuctionsWithOrderWaPrice(auctions, []);
    expect(enriched[0].waprice).toBe('88.5');
  });
});
