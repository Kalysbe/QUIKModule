import type { Auction, BuyOrder } from '@/types/auction';
import { getOrderYield, sortOrdersByYieldAsc } from '@/utils/allocation';

/** Номинал одной ГЦБ (сом) — стандарт для аукционов ГКВ/ГКО. */
const FACE_VALUE = 100;

export interface SummaryBidsVolumeBlock {
  quantity: number;
  nominalValue: number;
  actualValue: number;
  percentOfTotal: number;
}

export interface SummaryBidsRow {
  orderId: string;
  type: 'competitive' | 'nonCompetitive';
  price: number | null;
  cumulativeNominalValue: number;
  cumulativeReceipts: number;
  weightedAverageYield: number | null;
  yieldByPrice: number;
}

export interface SummaryBidsReportData {
  reportDate: string | null | undefined;
  auctionDate: string | null | undefined;
  securityKind: string;
  circulationDays: number | null;
  registrationNumber: string;
  securitiesQuantity: number;
  offerVolume: number;
  couponRate: number | null;
  participantCount: number;
  financialInstitutions: number;
  institutionalInvestors: number;
  investors: number;
  residents: number;
  nonResidents: number;
  competitive: SummaryBidsVolumeBlock;
  nonCompetitive: SummaryBidsVolumeBlock;
  total: SummaryBidsVolumeBlock;
  rows: SummaryBidsRow[];
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getOrderNominalValue(order: BuyOrder): number {
  if (order.quantity > 0) return order.quantity * FACE_VALUE;
  return order.amount;
}

export function getOrderReceipts(order: BuyOrder): number {
  const nominal = getOrderNominalValue(order);
  if (order.price > 0) return round2((nominal * order.price) / 100);
  return round2(order.amount);
}

function describeSecurity(secCode: string | undefined): {
  kind: string;
  circulationDays: number | null;
} {
  const code = (secCode ?? '').trim().toUpperCase();
  if (code.startsWith('GBA') && code.length >= 5) {
    const years = Number.parseInt(code.slice(3, 5), 10);
    if (Number.isFinite(years) && years > 0) {
      return {
        kind: `ГКО-${years} ${years === 1 ? 'годичные' : 'летние'}`,
        circulationDays: years * 365,
      };
    }
  }
  if (code.startsWith('GD') && code.length >= 5) {
    const weeks = Number.parseInt(code.slice(2, 5), 10);
    if (Number.isFinite(weeks) && weeks > 0) {
      const days = weeks * 7;
      const months = Math.round((weeks * 12) / 52);
      return {
        kind: months > 0 ? `ГКВ-${months} месячные` : `ГКВ-${weeks} недельные`,
        circulationDays: days,
      };
    }
  }
  return { kind: secCode?.trim() || '—', circulationDays: null };
}

function buildVolumeBlock(
  quantity: number,
  nominalValue: number,
  actualValue: number,
  totalNominal: number,
): SummaryBidsVolumeBlock {
  return {
    quantity,
    nominalValue,
    actualValue,
    percentOfTotal:
      totalNominal > 0 ? round2((nominalValue / totalNominal) * 100) : 0,
  };
}

export function buildSummaryBidsReport(
  auction: Auction,
  buyOrders: BuyOrder[],
): SummaryBidsReportData {
  const competitiveOrders = sortOrdersByYieldAsc(
    buyOrders.filter((order) => order.price > 0),
  );
  const nonCompetitiveOrders = buyOrders.filter((order) => order.price === 0);

  let cumulativeNominal = 0;
  let cumulativeReceipts = 0;
  let weightedYieldNumerator = 0;
  let weightedYieldDenominator = 0;

  const competitiveRows: SummaryBidsRow[] = competitiveOrders.map((order) => {
    const nominal = getOrderNominalValue(order);
    const receipts = getOrderReceipts(order);
    const yieldPercent = getOrderYield(order);

    cumulativeNominal += nominal;
    cumulativeReceipts = round2(cumulativeReceipts + receipts);
    weightedYieldNumerator += nominal * yieldPercent;
    weightedYieldDenominator += nominal;

    const weightedAverageYield =
      weightedYieldDenominator > 0
        ? round2(weightedYieldNumerator / weightedYieldDenominator)
        : null;

    return {
      orderId: order.orderId,
      type: 'competitive',
      price: order.price,
      cumulativeNominalValue: cumulativeNominal,
      cumulativeReceipts,
      weightedAverageYield,
      yieldByPrice: yieldPercent,
    };
  });

  const nonCompetitiveRows: SummaryBidsRow[] = nonCompetitiveOrders.map(
    (order) => {
      const nominal = getOrderNominalValue(order);
      const receipts = getOrderReceipts(order);
      const yieldPercent = getOrderYield(order);

      return {
        orderId: order.orderId,
        type: 'nonCompetitive',
        price: null,
        cumulativeNominalValue: nominal,
        cumulativeReceipts: receipts,
        weightedAverageYield: competitiveOrders.length > 0 ? yieldPercent : null,
        yieldByPrice: yieldPercent,
      };
    },
  );

  const sumOrders = (orders: BuyOrder[]) =>
    orders.reduce(
      (acc, order) => {
        acc.quantity += order.quantity;
        acc.nominalValue += getOrderNominalValue(order);
        acc.actualValue = round2(acc.actualValue + getOrderReceipts(order));
        return acc;
      },
      { quantity: 0, nominalValue: 0, actualValue: 0 },
    );

  const competitiveTotals = sumOrders(competitiveOrders);
  const nonCompetitiveTotals = sumOrders(nonCompetitiveOrders);
  const totalNominal =
    competitiveTotals.nominalValue + nonCompetitiveTotals.nominalValue;
  const totalQuantity =
    competitiveTotals.quantity + nonCompetitiveTotals.quantity;
  const totalActual = round2(
    competitiveTotals.actualValue + nonCompetitiveTotals.actualValue,
  );

  const participantNames = new Set(
    buyOrders
      .map((order) => order.firmName.trim() || order.dealerName.trim())
      .filter((name) => name && name !== '—'),
  );

  const securitiesQuantity = toNumber(auction.issuesize);
  const { kind, circulationDays } = describeSecurity(auction.SecCode);
  const couponRate = toNumber(auction.couponvalue);

  return {
    reportDate: auction.TradeDate,
    auctionDate: auction.TradeDate,
    securityKind: kind,
    circulationDays,
    registrationNumber: auction.SecCode ?? '—',
    securitiesQuantity,
    offerVolume: securitiesQuantity * FACE_VALUE,
    couponRate: couponRate > 0 ? couponRate : null,
    participantCount: participantNames.size,
    financialInstitutions: 0,
    institutionalInvestors: 0,
    investors: 0,
    residents: participantNames.size,
    nonResidents: 0,
    competitive: buildVolumeBlock(
      competitiveTotals.quantity,
      competitiveTotals.nominalValue,
      competitiveTotals.actualValue,
      totalNominal,
    ),
    nonCompetitive: buildVolumeBlock(
      nonCompetitiveTotals.quantity,
      nonCompetitiveTotals.nominalValue,
      nonCompetitiveTotals.actualValue,
      totalNominal,
    ),
    total: buildVolumeBlock(
      totalQuantity,
      totalNominal,
      totalActual,
      totalNominal,
    ),
    rows: [...nonCompetitiveRows, ...competitiveRows],
  };
}
