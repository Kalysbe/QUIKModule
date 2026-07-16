import { describe, expect, it } from 'vitest';
import type { BuyOrder } from '@/types/auction';
import { computePriceYieldStats } from './priceYieldStats';

function makeOrder(partial: Partial<BuyOrder> & Pick<BuyOrder, 'orderId'>): BuyOrder {
  return {
    instrument: 'GCB001',
    price: 0,
    quantity: 0,
    amount: 0,
    desiredYield: 0,
    account: '1',
    firmName: 'Dealer',
    dealerName: 'Dealer',
    submittedAt: '12:00:00',
    state: 'Активна',
    isActive: true,
    isReportable: true,
    ...partial,
  };
}

describe('computePriceYieldStats', () => {
  it('computes min/max/avg price and yield from competitive orders', () => {
    const stats = computePriceYieldStats([
      makeOrder({
        orderId: '7152',
        price: 93.34,
        quantity: 412,
        amount: 38456.08,
        desiredYield: 12,
      }),
      makeOrder({
        orderId: '7154',
        price: 93.08,
        quantity: 6222,
        amount: 579143.76,
        desiredYield: 12.51,
      }),
      makeOrder({
        orderId: '7157',
        price: 0,
        quantity: 1000,
        amount: 100_000,
      }),
    ]);

    expect(stats.minPrice).toBe(93.08);
    expect(stats.maxPrice).toBe(93.34);
    expect(stats.minYield).toBe(12);
    expect(stats.maxYield).toBe(12.51);
    expect(stats.avgPrice).toBeCloseTo(
      (93.34 * 412 + 93.08 * 6222) / (412 + 6222),
      2,
    );
    expect(stats.demandAmount).toBeCloseTo(38456.08 + 579143.76 + 100_000, 2);
    expect(stats.demandQuantity).toBe(412 + 6222 + 1000);
  });

  it('falls back to params when there are no competitive orders', () => {
    const stats = computePriceYieldStats([], {
      bid: 90,
      offer: 95,
      waprice: 92,
      value: 1000,
      qty: 10,
    });

    expect(stats.minPrice).toBe(90);
    expect(stats.maxPrice).toBe(95);
    expect(stats.avgPrice).toBe(92);
    expect(stats.demandAmount).toBe(1000);
    expect(stats.demandQuantity).toBe(10);
  });
});
