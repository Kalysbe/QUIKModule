import { describe, expect, it } from 'vitest';
import type { Auction, BuyOrder } from '@/types/auction';
import { buildOrderClassificationReport } from './buildOrderClassificationReport';

function makeOrder(partial: Partial<BuyOrder> & Pick<BuyOrder, 'orderId'>): BuyOrder {
  return {
    instrument: 'GD052270712',
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

describe('buildOrderClassificationReport', () => {
  it('sets non-competitive amount to 30% of issue volume', () => {
    const auction: Auction = {
      SecCode: 'GD052270712',
      TradeDate: '2026-07-16',
      issuesize: '54343',
    };

    const report = buildOrderClassificationReport(auction, [
      makeOrder({ orderId: '1', price: 0, amount: 416_925 }),
      makeOrder({ orderId: '2', price: 90, amount: 10_000, quantity: 100 }),
    ]);

    expect(report.issueVolume).toBe(54_343);
    expect(report.nonCompetitiveAmount).toBe(16_302.9);
  });
});
