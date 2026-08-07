import { describe, expect, it } from 'vitest';
import type { Auction, BuyOrder } from '@/types/auction';
import {
  buildOrderClassificationReport,
  isIncludedInOrderClassification,
  sumClassificationDemandNominal,
} from './buildOrderClassificationReport';

function makeOrder(partial: Partial<BuyOrder> & Pick<BuyOrder, 'orderId'>): BuyOrder {
  return {
    instrument: 'GD052270712',
    price: 0,
    quantity: 0,
    amount: 0,
    desiredYield: 0,
    account: '1',
    firmId: 'DEALER',
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

  it('sets nominal value as quantity * 100', () => {
    const auction: Auction = {
      SecCode: 'GBA02280720',
      TradeDate: '2026-07-17',
      issuesize: '6000000',
    };

    const report = buildOrderClassificationReport(auction, [
      makeOrder({
        orderId: '1',
        price: 86.3,
        quantity: 5_178_000,
        amount: 999_999,
        desiredYield: 13,
        firmName: 'AZDK',
      }),
      makeOrder({
        orderId: '2',
        price: 86.3,
        quantity: 9_993.54,
        amount: 1,
        desiredYield: 13,
        firmName: 'Senti',
      }),
    ]);

    expect(report.rows[0].nominalValue).toBe(517_800_000);
    expect(report.rows[1].nominalValue).toBe(999_354);
    expect(report.totalNominalValue).toBe(518_799_354);
  });

  it('includes «Снята» only when WithdrawDateTime matches auction end', () => {
    const auction: Auction = {
      SecCode: 'GBA02280720',
      TradeDate: '2026-07-17',
      endtime: '17:00:00',
      issuesize: '1000',
    };

    const atEnd = makeOrder({
      orderId: '1',
      state: 'Снята',
      isActive: false,
      isReportable: false,
      withdrawDateTime: '2026-07-17T17:00:00',
      price: 90,
      quantity: 10,
      firmName: 'AtEnd',
    });
    const early = makeOrder({
      orderId: '2',
      state: 'Снята',
      isActive: false,
      isReportable: false,
      withdrawDateTime: '2026-07-17T10:00:00',
      price: 91,
      quantity: 20,
      firmName: 'Early',
    });
    const active = makeOrder({
      orderId: '3',
      price: 92,
      quantity: 5,
      firmName: 'Active',
    });

    expect(isIncludedInOrderClassification(atEnd, auction)).toBe(true);
    expect(isIncludedInOrderClassification(early, auction)).toBe(false);
    expect(isIncludedInOrderClassification(active, auction)).toBe(true);

    const report = buildOrderClassificationReport(auction, [atEnd, early, active]);
    expect(report.rows.map((r) => r.dealerName).sort()).toEqual(
      ['Active', 'AtEnd'].sort(),
    );
    expect(report.totalNominalValue).toBe(1_500);
    expect(sumClassificationDemandNominal(auction, [atEnd, early, active])).toBe(
      report.totalNominalValue,
    );
  });
});
