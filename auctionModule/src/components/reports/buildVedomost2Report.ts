import type {
  Auction,
  BuyOrder,
  PreliminaryAllocationRow,
  PreliminaryCalculation,
  Trade,
} from '@/types/auction';
import {
  calculateAllocation,
  filterOrdersByCutOffPrice,
  getOrderYield,
  toWholeBonds,
} from '@/utils/allocation';
import { toDateKey } from '@/utils/auctionDate';
import { sumClassificationDemandNominal, getClassificationIssueVolume } from './buildOrderClassificationReport';

const FACE_VALUE = 100;

export interface PlacementBlock {
  quantity: number;
  nominalValue: number;
  actualValue: number;
  weightedAveragePrice: number | null;
  yieldPercent: number | null;
}

export interface AuctionComparisonMetrics {
  secCode: string;
  tradeDate: string | null | undefined;
  offerVolumeThousands: number;
  demandVolumeThousands: number;
  placementVolumeThousands: number;
  weightedAveragePrice: number | null;
  weightedAverageYield: number | null;
  maxPrice: number | null;
  yieldAtMaxPrice: number | null;
  cutOffPrice: number | null;
  yieldAtCutOff: number | null;
  competitive: PlacementBlock;
  nonCompetitive: PlacementBlock;
  total: PlacementBlock;
}

export interface ComparisonRow {
  label: string;
  current: number | null;
  previous: number | null;
  difference: number | null;
  isPercent?: boolean;
}

export interface Vedomost2ReportData {
  reportDate: string | null | undefined;
  current: AuctionComparisonMetrics;
  previous: AuctionComparisonMetrics | null;
  comparisonRows: ComparisonRow[];
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toThousands(value: number): number {
  return round2(value / 1000);
}

function emptyPlacementBlock(): PlacementBlock {
  return {
    quantity: 0,
    nominalValue: 0,
    actualValue: 0,
    weightedAveragePrice: null,
    yieldPercent: null,
  };
}

function parseTradeTime(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizeSecCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/** Текущая строка аукциона, а не все даты того же инструмента. */
function isCurrentAuction(item: Auction, current: Auction): boolean {
  const currentId = current.auction_id != null ? String(current.auction_id).trim() : '';
  const itemId = item.auction_id != null ? String(item.auction_id).trim() : '';
  const currentDate = toDateKey(current.TradeDate);
  const itemDate = toDateKey(item.TradeDate);

  if (currentId && itemId && currentId === itemId) {
    if (currentDate && itemDate) return currentDate === itemDate;
    return true;
  }

  return (
    Boolean(currentDate) &&
    currentDate === itemDate &&
    normalizeSecCode(current.SecCode) === normalizeSecCode(item.SecCode)
  );
}

/** Одна серия ГЦБ: одинаковый срок (GD052… / GBA05…). */
export function isSameSecuritySeries(
  left: string | undefined,
  right: string | undefined,
): boolean {
  const a = normalizeSecCode(left);
  const b = normalizeSecCode(right);
  if (!a || !b) return false;
  if (a.startsWith('GD') && b.startsWith('GD')) return a.slice(0, 5) === b.slice(0, 5);
  if (a.startsWith('GBA') && b.startsWith('GBA')) return a.slice(0, 5) === b.slice(0, 5);
  return a.slice(0, 3) === b.slice(0, 3);
}

export function findPreviousAuction(
  current: Auction,
  auctions: Auction[],
): Auction | null {
  const currentTime = parseTradeTime(current.TradeDate);
  const candidates = auctions.filter((item) => {
    if (isCurrentAuction(item, current)) return false;
    if (!isSameSecuritySeries(current.SecCode, item.SecCode)) return false;
    const time = parseTradeTime(item.TradeDate);
    if (currentTime > 0 && time > 0) return time < currentTime;
    return true;
  });

  if (candidates.length === 0) return null;

  const latestPrevious = [...candidates].sort(
    (left, right) => parseTradeTime(right.TradeDate) - parseTradeTime(left.TradeDate),
  )[0]!;
  const previousInstrument = normalizeSecCode(latestPrevious.SecCode);
  const sameInstrument = candidates.filter(
    (item) => normalizeSecCode(item.SecCode) === previousInstrument,
  );

  // Один инструмент мог размещаться дважды в разные дни — берём более раннюю дату.
  return [...sameInstrument].sort(
    (left, right) => parseTradeTime(left.TradeDate) - parseTradeTime(right.TradeDate),
  )[0] ?? null;
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

function buildAllocationRows(
  orders: BuyOrder[],
  offeredQty: number,
  cutOffPrice: number,
  preliminary: PreliminaryCalculation | null | undefined,
): Array<{
  orderId: string;
  type: 'competitive' | 'nonCompetitive';
  price: number;
  yield: number;
  allocated: number;
}> {
  if (preliminary?.rows?.length) {
    return preliminary.rows.map((row: PreliminaryAllocationRow) => ({
      orderId: row.orderId,
      type: row.type,
      price: row.price,
      yield: row.yield ?? 0,
      allocated: toWholeBonds(row.allocated),
    }));
  }

  const eligible = filterOrdersByCutOffPrice(orders, cutOffPrice);
  return calculateAllocation(eligible, offeredQty).map((row) => ({
    orderId: row.orderId,
    type: row.type,
    price: row.price,
    yield: row.yield,
    allocated: toWholeBonds(row.allocated),
  }));
}

function weightedAverage(
  items: Array<{ weight: number; value: number }>,
): number | null {
  let weightSum = 0;
  let valueSum = 0;
  for (const item of items) {
    if (item.weight <= 0) continue;
    weightSum += item.weight;
    valueSum += item.weight * item.value;
  }
  if (weightSum <= 0) return null;
  return round2(valueSum / weightSum);
}

function pickLowestPriceHighestYieldOrder(
  orders: Array<{ price: number; yieldPercent: number }>,
): { price: number; yieldPercent: number } | null {
  if (orders.length === 0) return null;
  return [...orders].sort((left, right) => {
    const priceDiff = left.price - right.price;
    if (priceDiff !== 0) return priceDiff;
    return right.yieldPercent - left.yieldPercent;
  })[0]!;
}

export function computeAuctionComparisonMetrics(
  auction: Auction,
  buyOrders: BuyOrder[],
  options: {
    preliminary?: PreliminaryCalculation | null;
    cutOffPrice?: number;
    /** Заявки для объёма спроса — как в классификации (включая «Снята» на окончании). */
    demandBuyOrders?: BuyOrder[];
  } = {},
): AuctionComparisonMetrics {
  const preliminary = options.preliminary ?? null;
  const cutOffPrice = resolveCutOffPrice(preliminary, options.cutOffPrice);
  const offeredQty = resolveOfferedQty(auction, preliminary);
  const allocationRows = buildAllocationRows(
    buyOrders,
    offeredQty,
    cutOffPrice,
    preliminary,
  );

  const orderById = new Map(buyOrders.map((order) => [order.orderId, order]));

  const competitiveOrders = buyOrders.filter((order) => order.price > 0);
  const demandNominal = sumClassificationDemandNominal(
    auction,
    options.demandBuyOrders ?? buyOrders,
  );

  let maxPrice: number | null = null;
  let yieldAtMaxPrice: number | null = null;
  for (const order of competitiveOrders) {
    if (maxPrice == null || order.price > maxPrice) {
      maxPrice = order.price;
      yieldAtMaxPrice = getOrderYield(order);
    }
  }

  const competitive = emptyPlacementBlock();
  const nonCompetitive = emptyPlacementBlock();
  const competitiveWeights: Array<{ weight: number; price: number; yield: number }> =
    [];

  for (const row of allocationRows) {
    if (row.allocated <= 0) continue;
    const order = orderById.get(row.orderId);
    const price = row.price > 0 ? row.price : order?.price ?? 0;
    const yieldPercent =
      row.yield > 0 ? row.yield : order ? getOrderYield(order) : 0;
    // И количество, и номинал — от распределённых бумаг (как в предварительных расчётах).
    const quantity = row.allocated;
    const nominal = quantity * FACE_VALUE;
    const actual =
      row.type === 'competitive' && price > 0
        ? round2((nominal * price) / FACE_VALUE)
        : 0;
    const target = row.type === 'competitive' ? competitive : nonCompetitive;

    target.quantity += quantity;
    target.nominalValue += nominal;
    target.actualValue = round2(target.actualValue + actual);

    if (row.type === 'competitive' && price > 0) {
      competitiveWeights.push({
        weight: row.allocated,
        price,
        yield: yieldPercent,
      });
    }
  }

  competitive.weightedAveragePrice = weightedAverage(
    competitiveWeights.map((item) => ({ weight: item.weight, value: item.price })),
  );
  competitive.yieldPercent = weightedAverage(
    competitiveWeights.map((item) => ({ weight: item.weight, value: item.yield })),
  );

  const waPrice = competitive.weightedAveragePrice;
  if (nonCompetitive.quantity > 0 && waPrice != null && waPrice > 0) {
    // Неконкурентные исполняются по средневзвешенной цене конкурентных.
    nonCompetitive.actualValue = round2(
      (nonCompetitive.nominalValue * waPrice) / FACE_VALUE,
    );
  }

  const total: PlacementBlock = {
    quantity: competitive.quantity + nonCompetitive.quantity,
    nominalValue: competitive.nominalValue + nonCompetitive.nominalValue,
    actualValue: round2(competitive.actualValue + nonCompetitive.actualValue),
    weightedAveragePrice: competitive.weightedAveragePrice,
    yieldPercent: competitive.yieldPercent,
  };

  const distributedCompetitiveOrders = allocationRows
    .filter((row) => row.type === 'competitive' && row.allocated > 0)
    .map((row) => {
      const order = orderById.get(row.orderId);
      const price = row.price > 0 ? row.price : order?.price ?? 0;
      const yieldPercent =
        row.yield > 0 ? row.yield : order ? getOrderYield(order) : 0;
      return { price, yieldPercent };
    })
    .filter((item) => item.price > 0);

  const lowestPriceHighestYieldOrder = pickLowestPriceHighestYieldOrder(
    distributedCompetitiveOrders,
  );
  const displayCutOffPrice = lowestPriceHighestYieldOrder?.price ?? null;
  const yieldAtCutOff = lowestPriceHighestYieldOrder?.yieldPercent ?? null;

  // «Объем выпуска» из классификации (issuesize) × 100 сом, в тыс. сомах.
  const offerVolumeThousands = toThousands(
    getClassificationIssueVolume(auction) * FACE_VALUE,
  );

  return {
    secCode: auction.SecCode ?? '—',
    tradeDate: auction.TradeDate,
    offerVolumeThousands,
    demandVolumeThousands: toThousands(demandNominal),
    placementVolumeThousands: toThousands(total.nominalValue),
    weightedAveragePrice: competitive.weightedAveragePrice,
    weightedAverageYield: competitive.yieldPercent,
    maxPrice,
    yieldAtMaxPrice,
    cutOffPrice: displayCutOffPrice,
    yieldAtCutOff,
    competitive,
    nonCompetitive,
    total,
  };
}

function resolveTradeYield(trade: Trade): number {
  if (trade.yieldValue > 0) return trade.yieldValue;
  if (trade.price > 0) return Math.max(0, 100 - trade.price);
  return 0;
}

function resolveTradeQuantity(trade: Trade): number {
  if (trade.quantity > 0) return toWholeBonds(trade.quantity);
  if (trade.amount > 0) {
    if (trade.price > 0) return toWholeBonds(trade.amount / trade.price);
    return toWholeBonds(trade.amount / FACE_VALUE);
  }
  return 0;
}

/**
 * Тип сделки по заявке Orders: неконкурентная, если у связанной заявки Price = 0.
 * После исполнения в Trades у всех сделок уже есть цена/доходность.
 */
function resolveTradePlacementType(
  trade: Trade,
  orderByNum: Map<string, BuyOrder>,
): 'competitive' | 'nonCompetitive' | null {
  const orderNum = trade.orderNum?.trim();
  if (!orderNum) return null;
  const order = orderByNum.get(orderNum);
  if (!order) return null;
  return order.price === 0 ? 'nonCompetitive' : 'competitive';
}

function finalizePlacementMetrics(
  auction: Auction,
  preliminary: PreliminaryCalculation | null,
  demandNominal: number,
  competitive: PlacementBlock,
  nonCompetitive: PlacementBlock,
  competitiveWeights: Array<{ weight: number; price: number; yield: number }>,
  competitivePriceYield: Array<{ price: number; yieldPercent: number }>,
  maxPrice: number | null,
  yieldAtMaxPrice: number | null,
): AuctionComparisonMetrics {
  competitive.weightedAveragePrice = weightedAverage(
    competitiveWeights.map((item) => ({ weight: item.weight, value: item.price })),
  );
  competitive.yieldPercent = weightedAverage(
    competitiveWeights.map((item) => ({ weight: item.weight, value: item.yield })),
  );

  const waPrice = competitive.weightedAveragePrice;
  if (nonCompetitive.quantity > 0 && waPrice != null && waPrice > 0) {
    if (nonCompetitive.nominalValue <= 0) {
      nonCompetitive.nominalValue = round2(nonCompetitive.quantity * FACE_VALUE);
    }
    // Количество/номинал уже от распределённых бумаг; по факту — по WA.
    nonCompetitive.actualValue = round2(
      (nonCompetitive.nominalValue * waPrice) / FACE_VALUE,
    );
  }

  const total: PlacementBlock = {
    quantity: competitive.quantity + nonCompetitive.quantity,
    nominalValue: competitive.nominalValue + nonCompetitive.nominalValue,
    actualValue: round2(competitive.actualValue + nonCompetitive.actualValue),
    weightedAveragePrice: competitive.weightedAveragePrice,
    yieldPercent: competitive.yieldPercent,
  };

  const lowestPriceHighestYieldOrder = pickLowestPriceHighestYieldOrder(
    competitivePriceYield,
  );
  // «Объем выпуска» из классификации (issuesize) × 100 сом, в тыс. сомах.
  const offerVolumeThousands = toThousands(
    getClassificationIssueVolume(auction) * FACE_VALUE,
  );

  return {
    secCode: auction.SecCode ?? '—',
    tradeDate: auction.TradeDate,
    offerVolumeThousands,
    demandVolumeThousands: toThousands(demandNominal),
    placementVolumeThousands: toThousands(total.nominalValue),
    weightedAveragePrice: competitive.weightedAveragePrice,
    weightedAverageYield: competitive.yieldPercent,
    maxPrice,
    yieldAtMaxPrice,
    cutOffPrice: lowestPriceHighestYieldOrder?.price ?? null,
    yieldAtCutOff: lowestPriceHighestYieldOrder?.yieldPercent ?? null,
    competitive,
    nonCompetitive,
    total,
  };
}

/** Итоги размещения по фактическим сделкам из БД (таблица Trades). */
export function computeAuctionComparisonMetricsFromTrades(
  auction: Auction,
  trades: Trade[],
  buyOrders: BuyOrder[],
  options: {
    preliminary?: PreliminaryCalculation | null;
    /** Заявки для объёма спроса — как в классификации (включая «Снята» на окончании). */
    demandBuyOrders?: BuyOrder[];
  } = {},
): AuctionComparisonMetrics {
  const preliminary = options.preliminary ?? null;
  const demandNominal = sumClassificationDemandNominal(
    auction,
    options.demandBuyOrders ?? buyOrders,
  );

  const orderByNum = new Map<string, BuyOrder>();
  for (const order of buyOrders) {
    const key = order.orderId?.trim();
    if (key) orderByNum.set(key, order);
  }

  const competitive = emptyPlacementBlock();
  const nonCompetitive = emptyPlacementBlock();
  const competitiveWeights: Array<{ weight: number; price: number; yield: number }> =
    [];
  const competitivePriceYield: Array<{ price: number; yieldPercent: number }> = [];

  let maxPrice: number | null = null;
  let yieldAtMaxPrice: number | null = null;

  for (const trade of trades) {
    // Берём только сторону покупателя: OrderNum есть в Orders.
    const type = resolveTradePlacementType(trade, orderByNum);
    if (!type) continue;

    const allocated = resolveTradeQuantity(trade);
    if (allocated <= 0 && trade.amount <= 0) continue;

    const price = trade.price;
    const yieldPercent = resolveTradeYield(trade);

    if (type === 'competitive') {
      if (maxPrice == null || price > maxPrice) {
        maxPrice = price;
        yieldAtMaxPrice = yieldPercent;
      }
    }

    const quantity =
      allocated > 0
        ? allocated
        : type === 'nonCompetitive' && trade.amount > 0
          ? toWholeBonds(trade.amount / FACE_VALUE)
          : 0;
    if (quantity <= 0) continue;

    const nominal = quantity * FACE_VALUE;
    const actual =
      type === 'competitive' && price > 0
        ? round2((nominal * price) / FACE_VALUE)
        : 0;
    const target = type === 'competitive' ? competitive : nonCompetitive;

    target.quantity += quantity;
    target.nominalValue += nominal;
    target.actualValue = round2(target.actualValue + actual);

    if (type === 'competitive' && price > 0 && quantity > 0) {
      competitiveWeights.push({
        weight: quantity,
        price,
        yield: yieldPercent,
      });
      competitivePriceYield.push({ price, yieldPercent });
    }
  }

  return finalizePlacementMetrics(
    auction,
    preliminary,
    demandNominal,
    competitive,
    nonCompetitive,
    competitiveWeights,
    competitivePriceYield,
    maxPrice,
    yieldAtMaxPrice,
  );
}

/** Сделки из БД имеют приоритет над предварительными расчётами. */
export function computeVedomost2Metrics(
  auction: Auction,
  buyOrders: BuyOrder[],
  trades: Trade[],
  options: {
    preliminary?: PreliminaryCalculation | null;
    cutOffPrice?: number;
    /** Заявки для объёма спроса — как в классификации (включая «Снята» на окончании). */
    demandBuyOrders?: BuyOrder[];
  } = {},
): AuctionComparisonMetrics {
  if (trades.length > 0) {
    const fromTrades = computeAuctionComparisonMetricsFromTrades(
      auction,
      trades,
      buyOrders,
      options,
    );
    // Нет связки OrderNum→Orders — не подменяем пустым размещением.
    if (fromTrades.total.quantity > 0 || fromTrades.total.nominalValue > 0) {
      return fromTrades;
    }
  }
  return computeAuctionComparisonMetrics(auction, buyOrders, options);
}

function diffValue(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return round2(current - previous);
}

export function buildVedomost2Report(
  current: AuctionComparisonMetrics,
  previous: AuctionComparisonMetrics | null = null,
  reportDate?: string | null,
): Vedomost2ReportData {
  const comparisonRows: ComparisonRow[] = [
    {
      label: 'Объем предложения (в тыс. сомах)',
      current: current.offerVolumeThousands,
      previous: previous?.offerVolumeThousands ?? null,
      difference: diffValue(
        current.offerVolumeThousands,
        previous?.offerVolumeThousands ?? null,
      ),
    },
    {
      label: 'Объем спроса (по номиналу, в тыс сомах)',
      current: current.demandVolumeThousands,
      previous: previous?.demandVolumeThousands ?? null,
      difference: diffValue(
        current.demandVolumeThousands,
        previous?.demandVolumeThousands ?? null,
      ),
    },
    {
      label: 'Объем размещения (по номиналу, в тыс сомах)',
      current: current.placementVolumeThousands,
      previous: previous?.placementVolumeThousands ?? null,
      difference: diffValue(
        current.placementVolumeThousands,
        previous?.placementVolumeThousands ?? null,
      ),
    },
    {
      label: 'Средневзвешенная цена (сомах)',
      current: current.weightedAveragePrice,
      previous: previous?.weightedAveragePrice ?? null,
      difference: diffValue(
        current.weightedAveragePrice,
        previous?.weightedAveragePrice ?? null,
      ),
    },
    {
      label: 'Средневзвешенная доходность, (в %)',
      current: current.weightedAverageYield,
      previous: previous?.weightedAverageYield ?? null,
      difference: diffValue(
        current.weightedAverageYield,
        previous?.weightedAverageYield ?? null,
      ),
      isPercent: true,
    },
    {
      label: 'Максимальная цена (в сомах)',
      current: current.maxPrice,
      previous: previous?.maxPrice ?? null,
      difference: diffValue(current.maxPrice, previous?.maxPrice ?? null),
    },
    {
      label: 'Доходность , в % по максимальной цене (в %)',
      current: current.yieldAtMaxPrice,
      previous: previous?.yieldAtMaxPrice ?? null,
      difference: diffValue(
        current.yieldAtMaxPrice,
        previous?.yieldAtMaxPrice ?? null,
      ),
      isPercent: true,
    },
    {
      label: 'Цена отсечения (в сомах)',
      current: current.cutOffPrice,
      previous: previous?.cutOffPrice ?? null,
      difference: diffValue(current.cutOffPrice, previous?.cutOffPrice ?? null),
    },
    {
      label: 'Доходность, в % по цене отсечения (в %)',
      current: current.yieldAtCutOff,
      previous: previous?.yieldAtCutOff ?? null,
      difference: diffValue(
        current.yieldAtCutOff,
        previous?.yieldAtCutOff ?? null,
      ),
      isPercent: true,
    },
  ];

  return {
    reportDate: reportDate ?? current.tradeDate,
    current,
    previous,
    comparisonRows,
  };
}
