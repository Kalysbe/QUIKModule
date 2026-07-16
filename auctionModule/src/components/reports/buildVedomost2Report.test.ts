import { describe, expect, it } from 'vitest';
import type { Auction, BuyOrder, Trade } from '@/types/auction';
import {
  buildVedomost2Report,
  computeAuctionComparisonMetrics,
  computeAuctionComparisonMetricsFromTrades,
  computeVedomost2Metrics,
  findPreviousAuction,
  isSameSecuritySeries,
} from './buildVedomost2Report';

function makeOrder(overrides: Partial<BuyOrder> = {}): BuyOrder {
  return {
    orderId: '1',
    instrument: 'GD052270614',
    price: 90.32,
    quantity: 2_144_200,
    amount: 214_420_000,
    desiredYield: 10.6,
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
  auction_id: 'cur',
  SecCode: 'GD052270614',
  ClassCode: 'GD',
  TradeDate: '2026-06-11',
  issuesize: '3000000',
};

describe('buildVedomost2Report', () => {
  it('computes placement results with cut-off price', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 90.32, quantity: 2_144_200, desiredYield: 10.6 }),
      makeOrder({
        orderId: '2',
        price: 89.18,
        quantity: 22_420,
        amount: 2_242_000,
        desiredYield: 12,
      }),
      makeOrder({
        orderId: '3',
        price: 88.38,
        quantity: 2_000_000,
        amount: 200_000_000,
        desiredYield: 13,
      }),
    ];

    const metrics = computeAuctionComparisonMetrics(auction, orders, {
      cutOffPrice: 90.32,
    });

    expect(metrics.competitive.quantity).toBe(2_144_200);
    expect(metrics.competitive.nominalValue).toBe(214_420_000);
    expect(metrics.competitive.actualValue).toBe(193_664_144);
    expect(metrics.competitive.weightedAveragePrice).toBe(90.32);
    expect(metrics.competitive.yieldPercent).toBe(10.6);
    expect(metrics.demandVolumeThousands).toBe(416_662);
    expect(metrics.placementVolumeThousands).toBe(214_420);
    expect(metrics.offerVolumeThousands).toBe(300_000);
    expect(metrics.maxPrice).toBe(90.32);
    expect(metrics.cutOffPrice).toBe(90.32);
    expect(metrics.yieldAtCutOff).toBe(10.6);
  });

  it('builds absolute differences against previous auction', () => {
    const currentOrders = [
      makeOrder({ orderId: '1', price: 90.32, quantity: 2_144_200, desiredYield: 10.6 }),
      makeOrder({
        orderId: '2',
        price: 89.18,
        quantity: 22_420,
        amount: 2_242_000,
        desiredYield: 12,
      }),
      makeOrder({
        orderId: '3',
        price: 88.38,
        quantity: 2_000_000,
        amount: 200_000_000,
        desiredYield: 13,
      }),
    ];
    const current = computeAuctionComparisonMetrics(auction, currentOrders, {
      cutOffPrice: 90.32,
    });

    const previousAuction: Auction = {
      auction_id: 'prev',
      SecCode: 'GD052270524',
      TradeDate: '2026-05-21',
      issuesize: '3000000',
    };
    const previous = computeAuctionComparisonMetrics(
      previousAuction,
      [
        makeOrder({
          orderId: 'p1',
          instrument: 'GD052270524',
          quantity: 116_500,
          amount: 11_650_000,
          desiredYield: 10.6,
        }),
      ],
      { cutOffPrice: 90.32 },
    );

    const report = buildVedomost2Report(current, previous);
    const demandRow = report.comparisonRows.find((row) =>
      row.label.includes('Объем спроса'),
    );
    const placementRow = report.comparisonRows.find((row) =>
      row.label.includes('Объем размещения'),
    );

    expect(demandRow?.current).toBe(416_662);
    expect(demandRow?.previous).toBe(11_650);
    expect(demandRow?.difference).toBe(405_012);
    expect(placementRow?.current).toBe(214_420);
    expect(placementRow?.previous).toBe(11_650);
    expect(placementRow?.difference).toBe(202_770);
  });

  it('uses requested amount for non-competitive nominal and wa price for actual', () => {
    const orders = [
      makeOrder({
        orderId: 'c1',
        price: 92.65,
        quantity: 18_060,
        amount: 1_806_000,
        desiredYield: 7.85,
      }),
      makeOrder({
        orderId: 'nc1',
        price: 0,
        quantity: 4_169,
        amount: 416_925,
        desiredYield: 0,
      }),
    ];

    const metrics = computeAuctionComparisonMetrics(auction, orders, {
      cutOffPrice: 92.65,
    });

    expect(metrics.competitive.weightedAveragePrice).toBe(92.65);
    expect(metrics.nonCompetitive.nominalValue).toBe(450_000);
    expect(metrics.nonCompetitive.actualValue).toBe(416_925);
    expect(metrics.nonCompetitive.quantity).toBe(4_500);
  });

  it('finds previous auction in the same series', () => {
    expect(isSameSecuritySeries('GD052270614', 'GD052270524')).toBe(true);
    expect(isSameSecuritySeries('GD052270614', 'GD026270614')).toBe(false);

    const previous = findPreviousAuction(auction, [
      {
        auction_id: 'older',
        SecCode: 'GD052270424',
        TradeDate: '2026-04-21',
      },
      {
        auction_id: 'prev',
        SecCode: 'GD052270524',
        TradeDate: '2026-05-21',
      },
      {
        auction_id: 'other',
        SecCode: 'GD026270614',
        TradeDate: '2026-06-01',
      },
    ]);

    expect(previous?.SecCode).toBe('GD052270524');
  });

  it('uses trades from DB when they are available', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 90.32, quantity: 2_144_200, desiredYield: 10.6 }),
      makeOrder({
        orderId: '2',
        price: 89.18,
        quantity: 22_420,
        amount: 2_242_000,
        desiredYield: 12,
      }),
    ];
    const trades: Trade[] = [
      {
        tradeId: 't1',
        instrument: 'GD052270614',
        price: 90.32,
        quantity: 1_000_000,
        amount: 90_320_000,
        yieldValue: 10.6,
        account: 'A1',
        firmName: 'Dealer',
        dealerName: 'Client',
        tradedAt: '12:00:00',
      },
    ];

    const fromTrades = computeAuctionComparisonMetricsFromTrades(auction, trades, orders);
    const fromOrders = computeAuctionComparisonMetrics(auction, orders, {
      cutOffPrice: 90.32,
    });
    const resolved = computeVedomost2Metrics(auction, orders, trades);

    expect(fromTrades.placementVolumeThousands).toBe(100_000);
    expect(fromTrades.competitive.weightedAveragePrice).toBe(90.32);
    expect(fromTrades.demandVolumeThousands).toBe(216_662);
    expect(resolved).toEqual(fromTrades);
    expect(fromOrders.placementVolumeThousands).toBe(214_420);
  });

  it('falls back to preliminary allocation when trades are absent', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 90.32, quantity: 2_144_200, desiredYield: 10.6 }),
    ];
    const metrics = computeVedomost2Metrics(auction, orders, [], { cutOffPrice: 90.32 });
    expect(metrics.placementVolumeThousands).toBe(214_420);
  });
});
