import type { BuyOrder } from '@/types/auction';
import { resolveTradingAccountEntry } from '@/config/tradingAccountsDirectory';

export const FACE_VALUE = 100;

export interface AllocationRow {
  orderId: string;
  price: number;
  yield: number;
  requested: number;
  allocated: number;
  requestedValue: number;
  allocatedValue: number;
  fulfillmentRate: number;
  type: 'competitive' | 'nonCompetitive';
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function toWholeBonds(value: number): number {
  return Math.max(0, Math.floor(value));
}

/**
 * Количество бумаг для расчёта.
 * Неконкурентные заявки в QUIK часто приходят с Qty=0 и Value=номинал —
 * тогда количество = объём / номинал (100).
 */
export function resolveOrderQuantity(
  quantity: number,
  amount: number,
  price: number,
): number {
  if (quantity > 0) return quantity;
  if (!(amount > 0)) return 0;
  if (price > 0) return amount / price;
  return amount / FACE_VALUE;
}

export function getOrderQuantity(order: BuyOrder): number {
  return resolveOrderQuantity(order.quantity, order.amount, order.price);
}

export function getOrderYield(order: BuyOrder): number {
  if (order.desiredYield > 0) return round4(order.desiredYield);
  if (order.price > 0) return round4(Math.max(0, 100 - order.price));
  return 0;
}

export function sortOrdersByYieldAsc(orders: BuyOrder[]): BuyOrder[] {
  return [...orders].sort((left, right) => {
    const yieldDiff = getOrderYield(left) - getOrderYield(right);
    if (yieldDiff !== 0) return yieldDiff;
    return left.price - right.price;
  });
}

export function filterOrdersByCutOffPrice(orders: BuyOrder[], cutOffPrice: number): BuyOrder[] {
  if (cutOffPrice <= 0) return orders;
  return orders.filter((order) => {
    // Неконкурентные (price=0) не отсекаются — как в splitOrdersByCompetition на бэкенде
    if (order.price === 0) return true;
    return order.price >= cutOffPrice;
  });
}

function getAllocatedValue(orderAmount: number, requested: number, allocated: number): number {
  if (requested <= 0 || orderAmount <= 0) return 0;
  if (allocated >= requested) return round4(orderAmount);
  return round4(orderAmount * (allocated / requested));
}

function buildAllocationRow(
  order: BuyOrder,
  params: {
    requested: number;
    allocated: number;
    type: 'competitive' | 'nonCompetitive';
    price?: number;
  },
): AllocationRow {
  const { requested, allocated, type } = params;

  return {
    orderId: order.orderId,
    price: params.price ?? order.price,
    yield: getOrderYield(order),
    requested,
    allocated,
    requestedValue: round4(order.amount),
    allocatedValue: getAllocatedValue(order.amount, requested, allocated),
    fulfillmentRate: requested > 0 ? round4((allocated / requested) * 100) : 0,
    type,
  };
}

export function mapOrdersToStatementRows(
  orders: BuyOrder[],
  allocationByOrderId: Map<string, AllocationRow>,
  type: 'competitive' | 'nonCompetitive',
): AllocationRow[] {
  return orders.map((order) => {
    const existing = allocationByOrderId.get(order.orderId);
    if (existing) return existing;

    const requested = toWholeBonds(getOrderQuantity(order));
    return buildAllocationRow(order, {
      requested,
      allocated: 0,
      type,
      price: order.price,
    });
  });
}

export function allocateProRata(
  requests: number[],
  totalToAllocate: number,
  remainderMode: 'largestRemainder' | 'lastDeal' = 'largestRemainder',
): number[] {
  if (requests.length === 0 || totalToAllocate <= 0) {
    return requests.map(() => 0);
  }
  const totalUnits = toWholeBonds(totalToAllocate);
  const requestUnits = requests.map((value) => toWholeBonds(value));
  const totalRequestUnits = requestUnits.reduce((sum, value) => sum + value, 0);

  if (totalRequestUnits === 0) {
    return requests.map(() => 0);
  }

  const base = requestUnits.map((value) =>
    Math.floor((value * totalUnits) / totalRequestUnits),
  );
  let allocatedUnits = base.reduce((sum, value) => sum + value, 0);

  if (remainderMode === 'lastDeal') {
    const lastIndex = requests.length - 1;
    if (lastIndex >= 0 && allocatedUnits < totalUnits) {
      base[lastIndex] += totalUnits - allocatedUnits;
    }
  } else {
    const fractions = requestUnits
      .map((value, index) => ({
        index,
        remainder: (value * totalUnits) % totalRequestUnits,
      }))
      .sort((a, b) => b.remainder - a.remainder);

    let cursor = 0;
    while (allocatedUnits < totalUnits && fractions.length > 0) {
      base[fractions[cursor].index] += 1;
      allocatedUnits += 1;
      cursor = (cursor + 1) % fractions.length;
    }
  }

  return base;
}

export function calculateAllocation(orders: BuyOrder[], offeredQty: number): AllocationRow[] {
  if (offeredQty <= 0 || orders.length === 0) return [];

  const competitive = orders
    .filter((order) => order.price > 0 && getOrderQuantity(order) > 0)
    .sort((a, b) => {
      if (b.price !== a.price) return b.price - a.price;
      return a.orderId.localeCompare(b.orderId);
    });
  const nonCompetitive = orders.filter(
    (order) => order.price === 0 && getOrderQuantity(order) > 0,
  );

  const result = new Map<string, AllocationRow>();
  let remaining = toWholeBonds(offeredQty);
  let index = 0;

  while (index < competitive.length && remaining > 0) {
    const currentPrice = competitive[index].price;
    const samePriceGroup: BuyOrder[] = [];
    while (index < competitive.length && competitive[index].price === currentPrice) {
      samePriceGroup.push(competitive[index]);
      index += 1;
    }

    const groupRequested = samePriceGroup.reduce(
      (sum, order) => sum + toWholeBonds(getOrderQuantity(order)),
      0,
    );
    if (groupRequested <= remaining) {
      samePriceGroup.forEach((order) => {
        const requested = toWholeBonds(getOrderQuantity(order));
        result.set(
          order.orderId,
          buildAllocationRow(order, {
            requested,
            allocated: requested,
            type: 'competitive',
          }),
        );
      });
      remaining -= groupRequested;
    } else {
      const shares = allocateProRata(
        samePriceGroup.map((order) => toWholeBonds(getOrderQuantity(order))),
        remaining,
      );
      samePriceGroup.forEach((order, groupIndex) => {
        const allocated = toWholeBonds(shares[groupIndex]);
        const requested = toWholeBonds(getOrderQuantity(order));
        result.set(
          order.orderId,
          buildAllocationRow(order, {
            requested,
            allocated,
            type: 'competitive',
          }),
        );
      });
      remaining = 0;
    }
  }

  if (remaining > 0 && nonCompetitive.length > 0) {
    const nonCompRequested = nonCompetitive.reduce(
      (sum, order) => sum + toWholeBonds(getOrderQuantity(order)),
      0,
    );
    const amount = Math.min(remaining, nonCompRequested);
    const shares = allocateProRata(
      nonCompetitive.map((order) => toWholeBonds(getOrderQuantity(order))),
      amount,
      'lastDeal',
    );
    nonCompetitive.forEach((order, idx) => {
      const allocated = toWholeBonds(shares[idx]);
      const requested = toWholeBonds(getOrderQuantity(order));
      result.set(
        order.orderId,
        buildAllocationRow(order, {
          requested,
          allocated,
          type: 'nonCompetitive',
          price: 0,
        }),
      );
    });
  }

  orders.forEach((order) => {
    const requested = toWholeBonds(getOrderQuantity(order));
    if (!result.has(order.orderId) && requested > 0) {
      result.set(
        order.orderId,
        buildAllocationRow(order, {
          requested,
          allocated: 0,
          type: order.price === 0 ? 'nonCompetitive' : 'competitive',
        }),
      );
    }
  });

  return Array.from(result.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'competitive' ? -1 : 1;
    if (b.price !== a.price) return b.price - a.price;
    return a.orderId.localeCompare(b.orderId);
  });
}

export function summarizeAllocationRows(rows: AllocationRow[]) {
  const activeRows = rows.filter((row) => row.requested > 0 || row.allocated > 0);
  const requested = activeRows.reduce((sum, row) => sum + row.requested, 0);
  const allocated = activeRows.reduce((sum, row) => sum + row.allocated, 0);
  const requestedValue = activeRows.reduce((sum, row) => sum + row.requestedValue, 0);
  const allocatedValue = activeRows.reduce((sum, row) => sum + row.allocatedValue, 0);
  const weightedYield =
    requested > 0
      ? activeRows.reduce((sum, row) => sum + row.yield * row.requested, 0) / requested
      : 0;

  return {
    count: rows.length,
    requested,
    allocated,
    requestedValue: round4(requestedValue),
    allocatedValue: round4(allocatedValue),
    avgYield: round4(weightedYield),
    fulfillmentRate: requested > 0 ? round4((allocated / requested) * 100) : 0,
  };
}

export function buildTriOrdersContent(params: {
  classCode: string;
  secCode: string;
  rows: AllocationRow[];
  startTransId?: number;
}): string {
  const startId = params.startTransId ?? 1;
  const { tradingAccount, clientCode } = resolveTradingAccountEntry(params.classCode);

  return params.rows
    .filter((row) => toWholeBonds(row.allocated) > 0)
    .map((row, idx) => {
      const transId = startId + idx;
      const price = Number.isFinite(row.price) ? row.price : 0;
      const qty = toWholeBonds(row.allocated);

      const fields: Array<[string, string | number]> = [
        ['TRANS_ID', transId],
        ['CLASSCODE', params.classCode],
        ['ACTION', 'Ввод заявки'],
        ['Класс', params.classCode],
        ['Инструмент', params.secCode],
        ['Торговый счет', tradingAccount],
        ['К/П', 'Продажа'],
        ['Цена', price.toFixed(2)],
        ['Количество', qty],
        ['Объем', '0.00'],
        ['Комментарий', clientCode],
        ['Тип', price > 0 ? 'Лимитированная' : 'Рыночная'],
        ['Условие исполнения', 'Поставить в очередь'],
        ['Количество/Объем', 'Количество'],
        ['Номер встречной заявки', row.orderId || ''],
      ];

      return fields.map(([k, v]) => `${k}=${v};`).join('');
    })
    .join('\r\n');
}

export function formatVolume(value: number): string {
  return round4(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
