import type {
  Auction,
  BuyOrder,
  PreliminaryAllocationRow,
  PreliminaryCalculation,
} from '@/types/auction';
import {
  calculateAllocation,
  filterOrdersByCutOffPrice,
  getOrderYield,
  sortOrdersByYieldAsc,
  toWholeBonds,
} from '@/utils/allocation';

const FACE_VALUE = 100;

export interface CentralDepositoryRow {
  orderId: string;
  dealerName: string;
  actualQuantity: number;
  actualValue: number;
  bidPrice: number;
  yieldPercent: number;
}

export interface CentralDepositoryReportData {
  reportDate: string | null | undefined;
  registrationNumber: string;
  auctionDate: string | null | undefined;
  issueVolume: number;
  nonCompetitiveAmount: number;
  rows: CentralDepositoryRow[];
  totalActualQuantity: number;
  totalActualValue: number;
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveCutOffPrice(
  preliminary: PreliminaryCalculation | null | undefined,
  explicitCutOff?: number,
): number {
  if (explicitCutOff != null && explicitCutOff > 0) return explicitCutOff;
  if (preliminary?.cutOffPrice != null && preliminary.cutOffPrice > 0) {
    return preliminary.cutOffPrice;
  }
  return 0;
}

function resolveOfferedQty(
  auction: Auction,
  preliminary: PreliminaryCalculation | null | undefined,
): number {
  if (preliminary?.offeredQty != null && preliminary.offeredQty > 0) {
    return preliminary.offeredQty;
  }
  const issueSize = toNumber(auction.issuesize);
  return issueSize > 0 ? issueSize : 0;
}

function buildAllocatedByOrderId(
  orders: BuyOrder[],
  offeredQty: number,
  cutOffPrice: number,
  preliminary: PreliminaryCalculation | null | undefined,
): Map<string, number> {
  const result = new Map<string, number>();

  if (preliminary?.rows?.length) {
    for (const row of preliminary.rows as PreliminaryAllocationRow[]) {
      result.set(row.orderId, toWholeBonds(row.allocated));
    }
    return result;
  }

  const eligible = filterOrdersByCutOffPrice(orders, cutOffPrice);
  for (const row of calculateAllocation(eligible, offeredQty)) {
    result.set(row.orderId, toWholeBonds(row.allocated));
  }
  return result;
}

export function buildCentralDepositoryReport(
  auction: Auction,
  buyOrders: BuyOrder[],
  options: {
    preliminary?: PreliminaryCalculation | null;
    cutOffPrice?: number;
  } = {},
): CentralDepositoryReportData {
  const preliminary = options.preliminary ?? null;
  const cutOffPrice = resolveCutOffPrice(preliminary, options.cutOffPrice);
  const offeredQty = resolveOfferedQty(auction, preliminary);
  const allocatedByOrderId = buildAllocatedByOrderId(
    buyOrders,
    offeredQty,
    cutOffPrice,
    preliminary,
  );

  const competitiveOrders = sortOrdersByYieldAsc(
    buyOrders.filter((order) => order.price > 0),
  );

  const rows: CentralDepositoryRow[] = competitiveOrders.map((order) => {
    const actualQuantity = allocatedByOrderId.get(order.orderId) ?? 0;
    const yieldPercent = getOrderYield(order);
    const actualValue =
      actualQuantity > 0 && order.price > 0
        ? round2((actualQuantity * FACE_VALUE * order.price) / 100)
        : 0;

    return {
      orderId: order.orderId,
      dealerName: order.firmName || order.dealerName || '—',
      actualQuantity,
      actualValue,
      bidPrice: order.price,
      yieldPercent,
    };
  });

  const nonCompetitiveAmount = buyOrders.reduce((sum, order) => {
    if (order.price !== 0) return sum;
    const allocated = allocatedByOrderId.get(order.orderId) ?? 0;
    if (allocated > 0) return sum + allocated * FACE_VALUE;
    return sum;
  }, 0);

  const totalActualQuantity = rows.reduce(
    (sum, row) => sum + row.actualQuantity,
    0,
  );
  const totalActualValue = round2(
    rows.reduce((sum, row) => sum + row.actualValue, 0),
  );
  const issueVolume = totalActualQuantity * FACE_VALUE;

  return {
    reportDate: auction.TradeDate,
    registrationNumber: auction.SecCode ?? '—',
    auctionDate: auction.TradeDate,
    issueVolume,
    nonCompetitiveAmount,
    rows,
    totalActualQuantity,
    totalActualValue,
  };
}
