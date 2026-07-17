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
  /** Срок обращения в годах (для отображения в ведомости). */
  circulationYears: number | null;
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

/** Статус/резидентство фирмы из справочника firm_status (ключ — FirmId). */
export interface FirmStatusLookup {
  statusName: string | null;
  resident: boolean | null;
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

/**
 * Классификация статуса фирмы для блока «Из них» сводной ведомости.
 * Институциональные инвесторы и страховые компании объединяются в одну строку отчёта.
 */
export function classifyFirmStatusCategory(
  statusName: string | null | undefined,
): 'financial' | 'institutional' | 'investor' | null {
  const normalized = (statusName ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('финансов')) return 'financial';
  if (normalized.includes('институционал') || normalized.includes('страхов')) {
    return 'institutional';
  }
  if (normalized.includes('инвестор')) return 'investor';
  return null;
}

function getParticipantKey(order: BuyOrder): string {
  const firmId = order.firmId?.trim();
  if (firmId) return firmId;
  const firmName = order.firmName?.trim();
  if (firmName && firmName !== '—') return `name:${firmName}`;
  const dealer = order.dealerName?.trim();
  if (dealer && dealer !== '—') return `dealer:${dealer}`;
  return '';
}

function countParticipantsByFirmStatus(
  buyOrders: BuyOrder[],
  firmStatuses: Record<string, FirmStatusLookup>,
): {
  participantCount: number;
  financialInstitutions: number;
  institutionalInvestors: number;
  investors: number;
  residents: number;
  nonResidents: number;
} {
  const participants = new Map<string, { firmId: string; firmName: string }>();

  for (const order of buyOrders) {
    const key = getParticipantKey(order);
    if (!key || participants.has(key)) continue;
    participants.set(key, {
      firmId: order.firmId?.trim() || '',
      firmName: order.firmName?.trim() || '',
    });
  }

  let financialInstitutions = 0;
  let institutionalInvestors = 0;
  let investors = 0;
  let residents = 0;
  let nonResidents = 0;

  for (const participant of participants.values()) {
    const byId = participant.firmId ? firmStatuses[participant.firmId] : undefined;
    const status = byId ?? null;
    const category = classifyFirmStatusCategory(status?.statusName);
    if (category === 'financial') financialInstitutions += 1;
    else if (category === 'institutional') institutionalInvestors += 1;
    else if (category === 'investor') investors += 1;

    if (status?.resident === true) residents += 1;
    else if (status?.resident === false) nonResidents += 1;
  }

  return {
    participantCount: participants.size,
    financialInstitutions,
    institutionalInvestors,
    investors,
    residents,
    nonResidents,
  };
}

/** Годовая купонная ставка: Округление(365 / couponperiod) * couponvalue. */
export function resolveAnnualCouponRate(
  couponValue: string | number | null | undefined,
  couponPeriod: string | number | null | undefined,
): number | null {
  const rate = toNumber(
    couponValue == null ? undefined : String(couponValue),
  );
  if (rate <= 0) return null;

  const period = toNumber(
    couponPeriod == null ? undefined : String(couponPeriod),
  );
  if (period <= 0) return round2(rate);

  return round2(Math.round(365 / period) * rate);
}

function describeSecurity(secCode: string | undefined): {
  kind: string;
  circulationDays: number | null;
  circulationYears: number | null;
} {
  const code = (secCode ?? '').trim().toUpperCase();
  if (code.startsWith('GBA') && code.length >= 5) {
    const years = Number.parseInt(code.slice(3, 5), 10);
    if (Number.isFinite(years) && years > 0) {
      return {
        kind: `ГКО-${years} ${years === 1 ? 'годичные' : 'летние'}`,
        circulationDays: years * 365,
        circulationYears: years,
      };
    }
  }
  if (code.startsWith('GD') && code.length >= 5) {
    const weeks = Number.parseInt(code.slice(2, 5), 10);
    if (Number.isFinite(weeks) && weeks > 0) {
      const days = weeks * 7;
      const months = Math.round((weeks * 12) / 52);
      const years = weeks / 52;
      return {
        kind: months > 0 ? `ГКВ-${months} месячные` : `ГКВ-${weeks} недельные`,
        circulationDays: days,
        circulationYears: round2(years),
      };
    }
  }
  return { kind: secCode?.trim() || '—', circulationDays: null, circulationYears: null };
}

/** Формат срока обращения в годах: «1 год», «2 года», «5 лет», «0,5 года». */
export function formatCirculationYears(years: number | null | undefined): string {
  if (years == null || !Number.isFinite(years) || years <= 0) return '—';

  const rounded = Math.round(years * 100) / 100;
  const isInteger = Number.isInteger(rounded);
  const valueText = rounded.toLocaleString('ru-RU', {
    minimumFractionDigits: isInteger ? 0 : 1,
    maximumFractionDigits: 2,
  });

  if (!isInteger) return `${valueText} года`;

  const n = Math.abs(Math.trunc(rounded)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${valueText} лет`;
  if (n1 === 1) return `${valueText} год`;
  if (n1 >= 2 && n1 <= 4) return `${valueText} года`;
  return `${valueText} лет`;
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
  firmStatuses: Record<string, FirmStatusLookup> = {},
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

  const participantStats = countParticipantsByFirmStatus(buyOrders, firmStatuses);

  const securitiesQuantity = toNumber(auction.issuesize);
  const { kind, circulationDays, circulationYears } = describeSecurity(auction.SecCode);
  const couponRate = resolveAnnualCouponRate(auction.couponvalue, auction.couponperiod);

  return {
    reportDate: auction.TradeDate,
    auctionDate: auction.TradeDate,
    securityKind: kind,
    circulationDays,
    circulationYears,
    registrationNumber: auction.SecCode ?? '—',
    securitiesQuantity,
    offerVolume: securitiesQuantity * FACE_VALUE,
    couponRate,
    participantCount: participantStats.participantCount,
    financialInstitutions: participantStats.financialInstitutions,
    institutionalInvestors: participantStats.institutionalInvestors,
    investors: participantStats.investors,
    residents: participantStats.residents,
    nonResidents: participantStats.nonResidents,
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
