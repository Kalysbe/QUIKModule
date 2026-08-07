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
    firmId: 'DEALER',
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

  it('uses allocated quantity for non-competitive settled at WA price', () => {
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
    expect(metrics.nonCompetitive.quantity).toBe(4_169);
    expect(metrics.nonCompetitive.nominalValue).toBe(416_900);
    expect(metrics.nonCompetitive.actualValue).toBe(386_257.85);
  });

  it('keeps non-competitive at 30% of N from preliminary allocation', () => {
    const orders = [
      makeOrder({
        orderId: '7194',
        price: 93.39,
        quantity: 2_720,
        amount: 254_020.8,
        desiredYield: 7,
      }),
      makeOrder({
        orderId: '7196',
        price: 92.52,
        quantity: 5_000,
        amount: 462_600,
        desiredYield: 8,
      }),
      makeOrder({
        orderId: '7195',
        price: 92.52,
        quantity: 15_340,
        amount: 1_419_256.8,
        desiredYield: 8,
      }),
      makeOrder({
        orderId: '7197',
        price: 0,
        quantity: 4_169,
        amount: 416_900,
        desiredYield: 0,
      }),
    ];

    const metrics = computeAuctionComparisonMetrics(auction, orders, {
      preliminary: {
        id: 1,
        auctionId: 'cur',
        classCode: 'GD',
        secCode: 'GD052270614',
        tradeDate: '2026-06-11',
        offeredQty: 12_000,
        requestedQty: 27_229,
        distributedQty: 12_000,
        coveragePct: 44.07,
        createdAt: '2026-07-16T18:22:54Z',
        rows: [
          {
            orderId: '7194',
            type: 'competitive',
            price: 93.39,
            yield: 7,
            requested: 2_720,
            allocated: 2_720,
            fulfillmentRate: 100,
          },
          {
            orderId: '7196',
            type: 'competitive',
            price: 92.52,
            yield: 8,
            requested: 5_000,
            allocated: 1_396,
            fulfillmentRate: 27.92,
          },
          {
            orderId: '7195',
            type: 'competitive',
            price: 92.52,
            yield: 8,
            requested: 15_340,
            allocated: 4_284,
            fulfillmentRate: 27.93,
          },
          {
            orderId: '7197',
            type: 'nonCompetitive',
            price: 0,
            yield: 0,
            requested: 4_169,
            allocated: 3_600,
            fulfillmentRate: 86.35,
          },
        ],
      },
    });

    expect(metrics.competitive.quantity).toBe(8_400);
    expect(metrics.competitive.nominalValue).toBe(840_000);
    expect(metrics.nonCompetitive.quantity).toBe(3_600);
    expect(metrics.nonCompetitive.nominalValue).toBe(360_000);
    expect(metrics.total.quantity).toBe(12_000);
    expect(metrics.total.nominalValue).toBe(1_200_000);
    // issuesize из классификации × 100 (3000000 × 100 → 300000 тыс.).
    expect(metrics.offerVolumeThousands).toBe(300_000);
    expect(metrics.placementVolumeThousands).toBe(1_200);
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
        orderNum: '1',
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

  it('classifies non-competitive trades via OrderNum even when trade has price', () => {
    const orders = [
      makeOrder({
        orderId: '7194',
        price: 93.39,
        quantity: 2_720,
        amount: 254_020.8,
        desiredYield: 7,
      }),
      makeOrder({
        orderId: '7197',
        price: 0,
        quantity: 4_169,
        amount: 416_900,
        desiredYield: 0,
      }),
    ];
    const trades: Trade[] = [
      {
        tradeId: '4838',
        orderNum: '7194',
        instrument: 'GD052270712',
        price: 93.39,
        quantity: 1_539,
        amount: 143_727.21,
        yieldValue: 7.67,
        account: '1-3001-74',
        firmName: 'GBR',
        dealerName: 'GBR',
        tradedAt: '19:32:12',
      },
      // Сторона продавца — OrderNum не из buy-заявок, пропускаем
      {
        tradeId: '4838',
        orderNum: '9001',
        instrument: 'GD052270712',
        price: 93.39,
        quantity: 1_539,
        amount: 143_727.21,
        yieldValue: 7.67,
        account: '1-3301-68',
        firmName: 'minfinown',
        dealerName: 'minfinown',
        tradedAt: '19:32:12',
      },
      // Неконкурентная: в Trades уже есть цена, тип только по Orders.Price = 0
      {
        tradeId: '4839',
        orderNum: '7197',
        instrument: 'GD052270712',
        price: 92.52,
        quantity: 3_600,
        amount: 333_072,
        yieldValue: 8,
        account: '1-3001-74',
        firmName: 'GBR',
        dealerName: 'GBR',
        tradedAt: '19:32:12',
      },
      {
        tradeId: '4839',
        orderNum: '9002',
        instrument: 'GD052270712',
        price: 92.52,
        quantity: 3_600,
        amount: 333_072,
        yieldValue: 8,
        account: '1-3301-68',
        firmName: 'minfinown',
        dealerName: 'minfinown',
        tradedAt: '19:32:12',
      },
    ];

    const metrics = computeAuctionComparisonMetricsFromTrades(auction, trades, orders);

    expect(metrics.competitive.quantity).toBe(1_539);
    expect(metrics.competitive.nominalValue).toBe(153_900);
    expect(metrics.nonCompetitive.quantity).toBe(3_600);
    expect(metrics.nonCompetitive.nominalValue).toBe(360_000);
    expect(metrics.total.quantity).toBe(5_139);
    expect(metrics.weightedAveragePrice).toBe(93.39);
    // Неконкурентные по факту оцениваются по WA конкурентных
    expect(metrics.nonCompetitive.actualValue).toBe(336_204);
  });

  it('falls back to preliminary allocation when trades are absent', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 90.32, quantity: 2_144_200, desiredYield: 10.6 }),
    ];
    const metrics = computeVedomost2Metrics(auction, orders, [], { cutOffPrice: 90.32 });
    expect(metrics.placementVolumeThousands).toBe(214_420);
  });

  it('uses classification demand set for «Объем спроса»', () => {
    const auctionWithEnd: Auction = {
      ...auction,
      endtime: '17:00:00',
    };
    const reportable = [
      makeOrder({ orderId: '1', price: 90.32, quantity: 1_000, desiredYield: 10.6 }),
    ];
    const withdrawnAtEnd = makeOrder({
      orderId: '2',
      state: 'Снята',
      isActive: false,
      isReportable: false,
      withdrawDateTime: '2026-06-11T17:00:00',
      price: 91,
      quantity: 500,
      desiredYield: 9,
    });

    const metrics = computeVedomost2Metrics(auctionWithEnd, reportable, [], {
      cutOffPrice: 90.32,
      demandBuyOrders: [...reportable, withdrawnAtEnd],
    });

    // (1000 + 500) × 100 / 1000 = 150
    expect(metrics.demandVolumeThousands).toBe(150);
    expect(metrics.placementVolumeThousands).toBe(100);
  });
});
