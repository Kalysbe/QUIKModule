import { describe, expect, it } from 'vitest';
import type { Auction, BuyOrder } from '@/types/auction';
import { buildCentralDepositoryReport } from './buildCentralDepositoryReport';

function makeOrder(overrides: Partial<BuyOrder> = {}): BuyOrder {
  return {
    orderId: '1',
    instrument: 'GD052270614',
    price: 90.32,
    quantity: 2_100_000,
    amount: 210_000_000,
    desiredYield: 10.6,
    account: 'A1',
    firmId: 'AZDK',
    firmName: 'Агентство по защите депозитов КР',
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
};

describe('buildCentralDepositoryReport', () => {
  it('shows allocated quantities and keeps unfilled bids with zero fact', () => {
    const orders = [
      makeOrder({
        orderId: '1',
        firmName: 'Агентство по защите депозитов КР',
        price: 90.32,
        quantity: 2_100_000,
        desiredYield: 10.6,
      }),
      makeOrder({
        orderId: '2',
        firmName: 'ЗАО СК "Кыргызстан"',
        price: 90.32,
        quantity: 44_200,
        amount: 4_420_000,
        desiredYield: 10.6,
      }),
      makeOrder({
        orderId: '3',
        firmName: 'ОАО "Айыл Банк"',
        price: 89.18,
        quantity: 22_420,
        amount: 2_242_000,
        desiredYield: 12,
      }),
      makeOrder({
        orderId: '4',
        firmName: 'ЗАО "Кыргызский Инвестиционно-Кредитный банк"',
        price: 88.38,
        quantity: 2_000_000,
        amount: 200_000_000,
        desiredYield: 13,
      }),
    ];

    const report = buildCentralDepositoryReport(auction, orders, {
      cutOffPrice: 90.32,
    });

    expect(report.issueVolume).toBe(214_420_000);
    expect(report.nonCompetitiveAmount).toBe(0);
    expect(report.rows).toHaveLength(4);

    expect(report.rows[0]).toMatchObject({
      dealerName: 'Агентство по защите депозитов КР',
      actualQuantity: 2_100_000,
      actualValue: 189_672_000,
      bidPrice: 90.32,
      yieldPercent: 10.6,
    });
    expect(report.rows[1]).toMatchObject({
      dealerName: 'ЗАО СК "Кыргызстан"',
      actualQuantity: 44_200,
      actualValue: 3_992_144,
      bidPrice: 90.32,
      yieldPercent: 10.6,
    });
    expect(report.rows[2]).toMatchObject({
      dealerName: 'ОАО "Айыл Банк"',
      actualQuantity: 0,
      actualValue: 0,
      bidPrice: 89.18,
      yieldPercent: 12,
    });
    expect(report.rows[3]).toMatchObject({
      actualQuantity: 0,
      actualValue: 0,
      bidPrice: 88.38,
      yieldPercent: 13,
    });

    expect(report.totalActualQuantity).toBe(2_144_200);
    expect(report.totalActualValue).toBe(193_664_144);
  });
});
