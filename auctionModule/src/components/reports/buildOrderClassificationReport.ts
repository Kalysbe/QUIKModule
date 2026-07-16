import type { Auction, BuyOrder } from '@/types/auction';

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

export function buildOrderClassificationReport(
  auction: Auction,
  buyOrders: BuyOrder[],
): OrderClassificationReportData {
  const sortedOrders = [...buyOrders]
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
    nominalValue: order.amount,
    bidPrice: order.price,
    yieldPercent: getOrderYield(order),
  }));

  const nonCompetitiveAmount = buyOrders.reduce((sum, order) => {
    if (order.price === 0) return sum + order.amount;
    return sum;
  }, 0);

  const totalNominalValue = rows.reduce((sum, row) => sum + row.nominalValue, 0);

  return {
    auctionId: auction.auction_id ?? auction.SecCode ?? '',
    registrationNumber: auction.SecCode ?? '—',
    auctionDate: auction.TradeDate,
    issueVolume: toNumber(auction.issuesize),
    nonCompetitiveAmount,
    reportDate: auction.TradeDate,
    rows,
    totalNominalValue,
  };
}
