import { describe, expect, it } from 'vitest';
import type { Auction, BuyOrder } from '@/types/auction';
import { buildSummaryBidsReport } from './buildSummaryBidsReport';

function makeOrder(overrides: Partial<BuyOrder> = {}): BuyOrder {
  return {
    orderId: '1',
    instrument: 'GD052270614',
    price: 90,
    quantity: 1000,
    amount: 100_000,
    desiredYield: 10,
    account: 'A1',
    firmName: 'Dealer',
    dealerName: 'Client',
    submittedAt: '10:00:00',
    state: 'Активна',
    isActive: true,
    isReportable: true,
    ...overrides,
  };
}

const auction: Auction = {
  SecCode: 'GD052270614',
  TradeDate: '2026-06-11',
  issuesize: '3000000',
  couponvalue: '0',
};

describe('buildSummaryBidsReport', () => {
  it('calculates cumulative nominal, receipts and weighted average yield', () => {
    const orders = [
      makeOrder({
        orderId: '1',
        price: 90.32,
        quantity: 2_144_200,
        amount: 214_420_000,
        desiredYield: 10.6,
        firmName: 'A',
      }),
      makeOrder({
        orderId: '2',
        price: 89.18,
        quantity: 22_420,
        amount: 2_242_000,
        desiredYield: 12,
        firmName: 'B',
      }),
      makeOrder({
        orderId: '3',
        price: 88.38,
        quantity: 2_000_000,
        amount: 200_000_000,
        desiredYield: 13,
        firmName: 'A',
      }),
    ];

    const report = buildSummaryBidsReport(auction, orders);

    expect(report.securityKind).toBe('ГКВ-12 месячные');
    expect(report.circulationDays).toBe(364);
    expect(report.offerVolume).toBe(300_000_000);
    expect(report.participantCount).toBe(2);

    expect(report.rows).toHaveLength(3);
    expect(report.rows[0]).toMatchObject({
      cumulativeNominalValue: 214_420_000,
      cumulativeReceipts: 193_664_144,
      weightedAverageYield: 10.6,
      yieldByPrice: 10.6,
    });
    expect(report.rows[1]).toMatchObject({
      cumulativeNominalValue: 216_662_000,
      cumulativeReceipts: 195_663_559.6,
      weightedAverageYield: 10.61,
      yieldByPrice: 12,
    });
    expect(report.rows[2]).toMatchObject({
      cumulativeNominalValue: 416_662_000,
      cumulativeReceipts: 372_423_559.6,
      weightedAverageYield: 11.76,
      yieldByPrice: 13,
    });

    expect(report.competitive.nominalValue).toBe(416_662_000);
    expect(report.competitive.actualValue).toBe(372_423_559.6);
    expect(report.competitive.percentOfTotal).toBe(100);
  });

  it('does not compute weighted average when there are no competitive orders', () => {
    const orders = [
      makeOrder({
        orderId: 'nc1',
        price: 0,
        quantity: 10_000,
        amount: 1_000_000,
        desiredYield: 11,
      }),
    ];

    const report = buildSummaryBidsReport(auction, orders);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].type).toBe('nonCompetitive');
    expect(report.rows[0].weightedAverageYield).toBeNull();
    expect(report.rows[0].yieldByPrice).toBe(11);
    expect(report.rows[0].cumulativeNominalValue).toBe(1_000_000);
  });

  it('uses order yield as weighted average for non-competitive rows', () => {
    const orders = [
      makeOrder({
        orderId: 'c1',
        price: 90,
        quantity: 1000,
        amount: 100_000,
        desiredYield: 10,
      }),
      makeOrder({
        orderId: 'nc1',
        price: 0,
        quantity: 500,
        amount: 50_000,
        desiredYield: 11.5,
      }),
    ];

    const report = buildSummaryBidsReport(auction, orders);
    const nonCompetitive = report.rows.find((row) => row.type === 'nonCompetitive');
    expect(nonCompetitive?.weightedAverageYield).toBe(11.5);
    expect(nonCompetitive?.cumulativeNominalValue).toBe(50_000);
    expect(nonCompetitive?.price).toBeNull();
  });
});
