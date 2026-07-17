export type AuctionField = string | number | null | undefined;

export interface BuyOrder {
  orderId: string;
  instrument: string;
  price: number;
  quantity: number;
  amount: number;
  desiredYield: number;
  account: string;
  /** Код фирмы из QUIK.Orders.FirmId */
  firmId: string;
  firmName: string;
  dealerName: string;
  submittedAt: string;
  state: string;
  isActive: boolean;
  isReportable: boolean;
}

export interface Trade {
  tradeId: string;
  /** Номер заявки из Trades.OrderNum — связь с Orders для типа заявки. */
  orderNum: string;
  instrument: string;
  price: number;
  quantity: number;
  amount: number;
  yieldValue: number;
  account: string;
  firmName: string;
  dealerName: string;
  tradedAt: string;
}

export interface PreliminaryAllocationRow {
  orderId: string;
  type: 'competitive' | 'nonCompetitive';
  price: number;
  yield?: number;
  requested: number;
  allocated: number;
  requestedValue?: number;
  allocatedValue?: number;
  fulfillmentRate: number;
}

export interface PreliminaryCalculation {
  id: number;
  auctionId: string;
  classCode: string;
  secCode: string;
  tradeDate: string | null;
  offeredQty: number;
  cutOffPrice?: number;
  requestedQty: number;
  distributedQty: number;
  coveragePct: number;
  rows: PreliminaryAllocationRow[];
  createdAt: string;
}

export interface Auction {
  ClassCode?: string;
  SecCode?: string;
  TradeDate?: string;
  status?: string;
  tradingstatus?: string;
  waprice?: string | null;
  starttime?: string;
  endtime?: string;
  bid?: string;
  offer?: string;
  numtrades?: string;
  couponvalue?: string;
  couponperiod?: string;
  nextcoupon?: string;
  issuesize?: string;
  yield?: string;
  last?: string;
  high?: string;
  low?: string;
  qty?: string;
  value?: string;
  lotsize?: string;
  auction_id?: string;
  [key: string]: AuctionField;
}

export interface AuctionPagination {
  limit: number;
  offset: number;
  count: number;
}

export interface AuctionListResponse {
  success: boolean;
  data: Auction[];
  pagination: AuctionPagination;
}

export type AuctionSortKey =
  | 'SecCode'
  | 'TradeDate'
  | 'status'
  | 'tradingstatus'
  | 'waprice'
  | 'starttime'
  | 'endtime';

export type SortDirection = 'asc' | 'desc';

export interface AuctionTableState {
  search: string;
  statusFilter: string;
  tradingStatusFilter: string;
  sortKey: AuctionSortKey;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
}
