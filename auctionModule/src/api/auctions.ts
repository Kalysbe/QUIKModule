import apiClient from '@/lib/axios';
import type {
  Auction,
  AuctionListResponse,
  PreliminaryAllocationRow,
  PreliminaryCalculation,
} from '@/types/auction';
import { matchesAuctionDate, toAuctionDateParam } from '@/utils/auctionDate';

export interface GetAuctionsParams {
  limit?: number;
  offset?: number;
  today?: boolean | '1' | '0' | 'false';
}

interface OrderApiItem {
  OrderNum?: string;
  ClassCode?: string;
  SecCode?: string;
  Price?: string;
  Qty?: string;
  Value?: string;
  Yield?: string;
  OrderDateTime?: string;
  Operation?: string;
  State?: string;
  TradingAccount?: string;
  Account?: string;
  Comment?: string;
  ClientCode?: string;
  ClientName?: string;
  FirmName?: string;
  FirmId?: string;
}

interface TradeApiItem {
  TradeNum?: string;
  OrderNum?: string;
  ClassCode?: string;
  SecCode?: string;
  Price?: string;
  Qty?: string;
  Value?: string;
  Yield?: string;
  TradeDateTime?: string;
  TradeDate?: string;
  Account?: string;
  TradingAccount?: string;
  Comment?: string;
  ClientCode?: string;
  ClientName?: string;
  FirmName?: string;
  FirmId?: string;
}

function normalizeToday(today: GetAuctionsParams['today']): string {
  if (today === true || today === '1') return '1';
  return 'false';
}

export async function getAuctions(
  params: GetAuctionsParams = {},
): Promise<AuctionListResponse> {
  const { data } = await apiClient.get<AuctionListResponse>('/params/auction', {
    params: {
      limit: params.limit ?? 200,
      offset: params.offset ?? 0,
      today: normalizeToday(params.today ?? false),
    },
  });

  if (!data.success) {
    throw new Error('Не удалось загрузить список аукционов');
  }

  return data;
}

export async function getAuctionById(auctionId: string): Promise<Auction | null> {
  const { data } = await apiClient.get<AuctionListResponse>('/params/auction', {
    params: {
      auction_id: auctionId,
      limit: 1,
      offset: 0,
      today: 'false',
    },
  });

  if (!data.success || !data.data?.length) {
    return null;
  }

  return data.data[0];
}

const detailCache = new Map<string, Promise<Auction | null>>();

export function prefetchAuctionById(auctionId: string): void {
  if (detailCache.has(auctionId)) return;
  detailCache.set(auctionId, getAuctionById(auctionId));
}

export async function getAuctionByIdCached(
  auctionId: string,
): Promise<Auction | null> {
  const cached = detailCache.get(auctionId);
  if (cached) {
    detailCache.delete(auctionId);
    return cached;
  }
  return getAuctionById(auctionId);
}

export async function getOrdersByInstrument(
  classCode: string,
  secCode: string,
  auctionDate?: string | null,
): Promise<OrderApiItem[]> {
  if (!classCode || !secCode) return [];
  const auctionDateParam = toAuctionDateParam(auctionDate);
  const { data } = await apiClient.get<OrderApiItem[]>('/orders/all', {
    params: {
      ClassCode: classCode,
      SecCode: secCode,
      ...(auctionDateParam ? { AuctionDate: auctionDateParam } : {}),
    },
  });
  const rows = Array.isArray(data) ? data : [];
  if (!auctionDateParam) return rows;

  // Доп. сверка даты заявки с датой аукциона на клиенте
  return rows.filter((order) =>
    matchesAuctionDate(order.OrderDateTime, auctionDate),
  );
}

/** Заявки по датам аукционов (YYYYMMDD) — для расчёта средневзв. цены в списке. */
export async function getOrdersByAuctionDates(
  auctionDates: string[],
): Promise<OrderApiItem[]> {
  const uniqueDates = [...new Set(auctionDates.filter(Boolean))];
  if (uniqueDates.length === 0) {
    const { data } = await apiClient.get<OrderApiItem[]>('/orders/all', {
      params: { today: '1' },
    });
    return Array.isArray(data) ? data : [];
  }

  const batches = await Promise.all(
    uniqueDates.map(async (AuctionDate) => {
      const { data } = await apiClient.get<OrderApiItem[]>('/orders/all', {
        params: { AuctionDate },
      });
      return Array.isArray(data) ? data : [];
    }),
  );

  return batches.flat();
}

export async function getTradesByInstrument(
  classCode: string,
  secCode: string,
  auctionDate?: string | null,
): Promise<TradeApiItem[]> {
  if (!classCode || !secCode) return [];
  const auctionDateParam = toAuctionDateParam(auctionDate);
  const { data } = await apiClient.get<TradeApiItem[]>('/orders/trades/all', {
    params: {
      ClassCode: classCode,
      SecCode: secCode,
      ...(auctionDateParam ? { AuctionDate: auctionDateParam } : {}),
    },
  });
  const rows = Array.isArray(data) ? data : [];
  if (!auctionDateParam) return rows;

  return rows.filter((trade) =>
    matchesAuctionDate(trade.TradeDateTime ?? trade.TradeDate, auctionDate),
  );
}

export interface SavePreliminaryCalculationPayload {
  auctionId: string;
  classCode: string;
  secCode: string;
  tradeDate?: string | null;
  offeredQty: number;
  cutOffPrice?: number;
  requestedQty: number;
  distributedQty: number;
  coveragePct: number;
  rows: PreliminaryAllocationRow[];
}

interface PreliminaryCalculationResponse {
  success: boolean;
  message?: string;
  data: PreliminaryCalculation | null;
}

export async function savePreliminaryCalculation(
  payload: SavePreliminaryCalculationPayload,
): Promise<PreliminaryCalculation> {
  const { data } = await apiClient.post<PreliminaryCalculationResponse>(
    '/auctions/preliminary-calculations',
    payload,
  );

  if (!data.success || !data.data) {
    throw new Error(data.message ?? 'Не удалось сохранить предварительные расчёты');
  }

  return data.data;
}

export async function getLatestPreliminaryCalculation(
  auctionId: string,
): Promise<PreliminaryCalculation | null> {
  const { data } = await apiClient.get<PreliminaryCalculationResponse>(
    '/auctions/preliminary-calculations',
    { params: { auction_id: auctionId } },
  );

  if (!data.success) {
    throw new Error('Не удалось загрузить предварительные расчёты');
  }

  return data.data;
}

interface PreliminaryCalculationListResponse {
  success: boolean;
  data: PreliminaryCalculation[];
}

export async function getPreliminaryCalculationHistory(
  auctionId: string,
  limit = 20,
): Promise<PreliminaryCalculation[]> {
  try {
    const { data } = await apiClient.get<PreliminaryCalculationListResponse>(
      '/auctions/preliminary-calculations/history',
      { params: { auction_id: auctionId, limit } },
    );

    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
  } catch {
    // History endpoint may be unavailable on older API versions
  }

  const latest = await getLatestPreliminaryCalculation(auctionId);
  return latest ? [latest] : [];
}
