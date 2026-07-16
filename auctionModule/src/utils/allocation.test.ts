import { describe, expect, it } from 'vitest';
import type { BuyOrder } from '@/types/auction';
import {
  allocateProRata,
  buildTriOrdersContent,
  calculateAllocation,
  filterOrdersByCutOffPrice,
  resolveOrderQuantity,
  sortOrdersByYieldAsc,
  toWholeBonds,
} from '@/utils/allocation';

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

describe('allocateProRata', () => {
  it('distributes whole bonds using largest remainder', () => {
    expect(allocateProRata([3, 3, 3], 10)).toEqual([4, 3, 3]);
  });

  it('assigns remainder to last deal when requested', () => {
    expect(allocateProRata([2, 2, 2], 5, 'lastDeal')).toEqual([1, 1, 3]);
  });
});

describe('filterOrdersByCutOffPrice', () => {
  it('keeps non-competitive orders when cut-off price is set', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 90, quantity: 10 }),
      makeOrder({ orderId: '2', price: 88, quantity: 10 }),
      makeOrder({ orderId: '3', price: 0, quantity: 5 }),
    ];

    const filtered = filterOrdersByCutOffPrice(orders, 89);
    expect(filtered.map((order) => order.orderId)).toEqual(['1', '3']);
  });

  it('includes competitive orders at or above cut-off', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 89, quantity: 10 }),
      makeOrder({ orderId: '2', price: 88, quantity: 10 }),
    ];

    const filtered = filterOrdersByCutOffPrice(orders, 89);
    expect(filtered.map((order) => order.orderId)).toEqual(['1']);
  });
});

describe('resolveOrderQuantity', () => {
  it('keeps explicit quantity', () => {
    expect(resolveOrderQuantity(412, 38456.08, 93.34)).toBe(412);
  });

  it('derives quantity from nominal value for non-competitive orders', () => {
    expect(resolveOrderQuantity(0, 100_000, 0)).toBe(1000);
  });

  it('derives quantity from value and price for competitive orders', () => {
    expect(resolveOrderQuantity(0, 38456.08, 93.34)).toBeCloseTo(412);
  });
});

describe('calculateAllocation', () => {
  it('fully allocates when demand is lower than offer', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 95, quantity: 10, amount: 1000 }),
      makeOrder({ orderId: '2', price: 94, quantity: 20, amount: 2000 }),
    ];

    const rows = calculateAllocation(orders, 50);
    const allocated = rows.reduce((sum, row) => sum + row.allocated, 0);
    expect(allocated).toBe(30);
  });

  it('pro-rata allocates within same price level', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 95, quantity: 10, amount: 1000 }),
      makeOrder({ orderId: '2', price: 95, quantity: 10, amount: 1000 }),
    ];

    const rows = calculateAllocation(orders, 15);
    const byId = new Map(rows.map((row) => [row.orderId, row.allocated]));
    expect(byId.get('1')).toBe(8);
    expect(byId.get('2')).toBe(7);
  });

  it('allocates remainder to non-competitive orders with Qty=0 and Value set', () => {
    const orders = [
      makeOrder({ orderId: '7152', price: 93.34, quantity: 412, amount: 38456.08 }),
      makeOrder({ orderId: '7154', price: 93.08, quantity: 6222, amount: 579143.76 }),
      makeOrder({ orderId: '7157', price: 0, quantity: 0, amount: 100_000 }),
    ];

    const rows = calculateAllocation(orders, 600_000);
    const byId = new Map(rows.map((row) => [row.orderId, row]));

    expect(byId.get('7157')?.requested).toBe(1000);
    expect(byId.get('7157')?.allocated).toBe(1000);
    expect(byId.get('7157')?.type).toBe('nonCompetitive');
  });
});

describe('sortOrdersByYieldAsc', () => {
  it('sorts by yield ascending', () => {
    const orders = [
      makeOrder({ orderId: '1', price: 87, desiredYield: 13 }),
      makeOrder({ orderId: '2', price: 90, desiredYield: 10 }),
    ];

    const sorted = sortOrdersByYieldAsc(orders);
    expect(sorted.map((order) => order.orderId)).toEqual(['2', '1']);
  });
});

describe('buildTriOrdersContent', () => {
  it('builds QUIK-compatible rows for allocated orders', () => {
    const content = buildTriOrdersContent({
      classCode: 'GKO',
      secCode: 'GCB001',
      rows: [
        {
          orderId: '1001',
          price: 95.5,
          yield: 4.5,
          requested: 10,
          allocated: 10,
          requestedValue: 1000,
          allocatedValue: 1000,
          fulfillmentRate: 100,
          type: 'competitive',
        },
      ],
    });

    expect(content).toContain('CLASSCODE=GKO');
    expect(content).toContain('Инструмент=GCB001');
    expect(content).toContain('Цена=95.50');
    expect(content).toContain('Количество=10');
    expect(content).toContain('Номер встречной заявки=1001');
    expect(toWholeBonds(10.9)).toBe(10);
  });
});
