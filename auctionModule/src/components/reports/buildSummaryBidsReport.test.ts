import { describe, expect, it } from 'vitest';
import type { Auction, BuyOrder } from '@/types/auction';
import {
  buildSummaryBidsReport,
  formatCirculationYears,
  resolveAnnualCouponRate,
} from './buildSummaryBidsReport';

function makeOrder(overrides: Partial<BuyOrder> = {}): BuyOrder {
  return {
    orderId: '1',
    instrument: 'GD052270614',
    price: 90,
    quantity: 1000,
    amount: 100_000,
    desiredYield: 10,
    account: 'A1',
    firmId: '',
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
    expect(report.circulationYears).toBe(1);
    expect(formatCirculationYears(report.circulationYears)).toBe('1 год');
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

  it('counts participant categories from firm_status lookup', () => {
    const orders = [
      makeOrder({ orderId: '1', firmId: 'BANK1', firmName: 'Bank' }),
      makeOrder({ orderId: '2', firmId: 'INS1', firmName: 'Insurance' }),
      makeOrder({ orderId: '3', firmId: 'INV1', firmName: 'Investor' }),
      makeOrder({ orderId: '4', firmId: 'BANK1', firmName: 'Bank' }),
    ];

    const report = buildSummaryBidsReport(auction, orders, {
      BANK1: { statusName: 'Финансовые институты', resident: true },
      INS1: { statusName: 'страховые компании', resident: true },
      INV1: { statusName: 'Инвесторы', resident: false },
    });

    expect(report.participantCount).toBe(3);
    expect(report.financialInstitutions).toBe(1);
    expect(report.institutionalInvestors).toBe(1);
    expect(report.investors).toBe(1);
    expect(report.residents).toBe(2);
    expect(report.nonResidents).toBe(1);
  });

  it('computes annual coupon rate as Round(365/couponperiod)*couponvalue', () => {
    expect(resolveAnnualCouponRate('5', '182')).toBe(10);
    expect(resolveAnnualCouponRate('5.5', '91')).toBe(22);
    expect(resolveAnnualCouponRate('10', '365')).toBe(10);
    expect(resolveAnnualCouponRate('0', '182')).toBeNull();

    const report = buildSummaryBidsReport(
      { ...auction, couponvalue: '5', couponperiod: '182' },
      [makeOrder()],
    );
    expect(report.couponRate).toBe(10);
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

  it('collapses rows with same price into one cumulative row', () => {
    const orders = [
      makeOrder({
        orderId: '1',
        price: 86.3,
        quantity: 11_580,
        amount: 1_158_000,
        desiredYield: 13,
      }),
      makeOrder({
        orderId: '2',
        price: 86.3,
        quantity: 6_000_000,
        amount: 600_000_000,
        desiredYield: 13,
      }),
      makeOrder({
        orderId: '3',
        price: 82.51,
        quantity: 400_000,
        amount: 40_000_000,
        desiredYield: 15.5,
      }),
    ];

    const report = buildSummaryBidsReport(auction, orders);
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]).toMatchObject({
      price: 86.3,
      cumulativeNominalValue: 601_158_000,
      cumulativeReceipts: 518_799_354,
      yieldByPrice: 13,
    });
    expect(report.rows[1]).toMatchObject({
      price: 82.51,
      cumulativeNominalValue: 641_158_000,
      cumulativeReceipts: 551_803_354,
      yieldByPrice: 15.5,
    });
  });

  it('includes «Снята» at auction end in demand like classification', () => {
    const auctionWithEnd: Auction = {
      ...auction,
      endtime: '17:00:00',
    };
    const orders = [
      makeOrder({
        orderId: '1',
        price: 90,
        quantity: 1000,
        amount: 100_000,
      }),
      makeOrder({
        orderId: '2',
        state: 'Снята',
        isActive: false,
        isReportable: false,
        withdrawDateTime: '2026-06-11T17:00:00',
        price: 91,
        quantity: 500,
        amount: 50_000,
      }),
      makeOrder({
        orderId: '3',
        state: 'Снята',
        isActive: false,
        isReportable: false,
        withdrawDateTime: '2026-06-11T10:00:00',
        price: 92,
        quantity: 200,
        amount: 20_000,
      }),
    ];

    const report = buildSummaryBidsReport(auctionWithEnd, orders);
    expect(report.total.nominalValue).toBe(150_000);
    expect(report.total.quantity).toBe(1500);
  });
});
