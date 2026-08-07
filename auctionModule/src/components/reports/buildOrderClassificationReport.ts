import type { Auction, BuyOrder } from '@/types/auction';
import { NON_COMPETITIVE_SHARE } from '@/utils/allocation';
import { isCancelledOrderState } from '@/utils/orderState';
import { isWithdrawnAtAuctionEnd } from '@/utils/orderWithdraw';

export interface OrderClassificationRow {
  dealerName: string;
  nominalValue: number;
  bidPrice: number;
  yieldPercent: number;
}

export interface OrderClassificationReportData {
  auctionId: string;
  registrationNumber: string;
  auctionDate: string | null | undefined;
  issueVolume: number;
  nonCompetitiveAmount: number;
  reportDate: string | null | undefined;
  rows: OrderClassificationRow[];
  totalNominalValue: number;
}

function getOrderYield(order: BuyOrder): number {
  if (order.desiredYield > 0) return order.desiredYield;
  if (order.price > 0) return Math.max(0, 100 - order.price);
  return 0;
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** «Объем выпуска (сом)» в классификации заявок — значение issuesize как есть. */
export function getClassificationIssueVolume(auction: Auction): number {
  return toNumber(auction.issuesize);
}

/** Заявки для классификации: обычные + «Снята» только при WithdrawDateTime = окончание аукциона. */
export function isIncludedInOrderClassification(
  order: BuyOrder,
  auction: Auction,
): boolean {
  if (
    isWithdrawnAtAuctionEnd(
      order.state,
      order.withdrawDateTime,
      auction.TradeDate,
      auction.endtime,
    )
  ) {
    return true;
  }
  return !isCancelledOrderState(order.state);
}

/** Номинал заявки в классификации (сом): Qty × 100. */
export function getClassificationOrderNominalValue(order: BuyOrder): number {
  return round2(order.quantity * 100);
}

/**
 * Объём спроса по номиналу (сом) — та же сумма «Итого», что в классификации заявок.
 * Используется в сводной ведомости и в поле спроса ведомости 2.
 */
export function sumClassificationDemandNominal(
  auction: Auction,
  buyOrders: BuyOrder[],
): number {
  return buyOrders
    .filter((order) => isIncludedInOrderClassification(order, auction))
    .reduce((sum, order) => sum + getClassificationOrderNominalValue(order), 0);
}

export function buildOrderClassificationReport(
  auction: Auction,
  buyOrders: BuyOrder[],
): OrderClassificationReportData {
  const sortedOrders = [...buyOrders]
    .filter((order) => isIncludedInOrderClassification(order, auction))
    .sort((left, right) => {
      const leftIsNonCompetitive = left.price <= 0;
      const rightIsNonCompetitive = right.price <= 0;

      if (leftIsNonCompetitive !== rightIsNonCompetitive) {
        return leftIsNonCompetitive ? -1 : 1;
      }

      if (leftIsNonCompetitive && rightIsNonCompetitive) {
        return 0;
      }

      const yieldDiff = getOrderYield(left) - getOrderYield(right);
      if (yieldDiff !== 0) return yieldDiff;
      return left.price - right.price;
    });

  const rows: OrderClassificationRow[] = sortedOrders.map((order) => ({
    dealerName: order.firmName || '—',
    nominalValue: getClassificationOrderNominalValue(order),
    bidPrice: order.price,
    yieldPercent: getOrderYield(order),
  }));

  const issueVolume = getClassificationIssueVolume(auction);
  // Лимит неконкурентных — строго 30% от объёма выпуска.
  const nonCompetitiveAmount = round2(issueVolume * NON_COMPETITIVE_SHARE);

  const totalNominalValue = sumClassificationDemandNominal(auction, buyOrders);

  return {
    auctionId: auction.auction_id ?? auction.SecCode ?? '',
    registrationNumber: auction.SecCode ?? '—',
    auctionDate: auction.TradeDate,
    issueVolume,
    nonCompetitiveAmount,
    reportDate: auction.TradeDate,
    rows,
    totalNominalValue,
  };
}
