import type {
  Auction,
  AuctionSortKey,
  AuctionTableState,
  SortDirection,
} from '@/types/auction';

function normalizeStr(value: string | null | undefined): string {
  return (value ?? '').toString().toLowerCase().trim();
}

function compareValues(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDirection,
): number {
  const av = normalizeStr(a);
  const bv = normalizeStr(b);
  const cmp = av.localeCompare(bv, 'ru', { numeric: true });
  return dir === 'asc' ? cmp : -cmp;
}

function parseSortableDate(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function compareAuctions(
  a: Auction,
  b: Auction,
  sortKey: AuctionSortKey,
  sortDir: SortDirection,
): number {
  const primaryCmp =
    sortKey === 'TradeDate'
      ? parseSortableDate(a.TradeDate as string) - parseSortableDate(b.TradeDate as string)
      : compareValues(a[sortKey] as string, b[sortKey] as string, 'asc');

  const cmp =
    primaryCmp === 0 && sortKey !== 'SecCode'
      ? compareValues(a.SecCode, b.SecCode, 'asc')
      : primaryCmp;

  return sortDir === 'asc' ? cmp : -cmp;
}

export function filterAuctions(
  auctions: Auction[],
  search: string,
  statusFilter = '',
  tradingStatusFilter = '',
): Auction[] {
  const q = search.trim().toLowerCase();

  return auctions.filter((item) => {
    if (q) {
      const secCode = normalizeStr(item.SecCode);
      const auctionId = normalizeStr(item.auction_id);
      if (!secCode.includes(q) && !auctionId.includes(q)) return false;
    }

    if (statusFilter && normalizeStr(item.status) !== normalizeStr(statusFilter)) {
      return false;
    }

    if (
      tradingStatusFilter &&
      normalizeStr(item.tradingstatus) !== normalizeStr(tradingStatusFilter)
    ) {
      return false;
    }

    return true;
  });
}

export function sortAuctions(
  auctions: Auction[],
  sortKey: AuctionSortKey,
  sortDir: SortDirection,
): Auction[] {
  return [...auctions].sort((a, b) => compareAuctions(a, b, sortKey, sortDir));
}

export function paginateAuctions<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; totalPages: number; total: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    total,
  };
}

export function processAuctionTable(
  auctions: Auction[],
  state: AuctionTableState,
): {
  items: Auction[];
  total: number;
  totalPages: number;
  page: number;
} {
  const filtered = filterAuctions(
    auctions,
    state.search,
    state.statusFilter,
    state.tradingStatusFilter,
  );
  const sorted = sortAuctions(filtered, state.sortKey, state.sortDir);
  const { items, totalPages, total } = paginateAuctions(
    sorted,
    state.page,
    state.pageSize,
  );

  const page = Math.min(Math.max(1, state.page), totalPages);

  return { items, total, totalPages, page };
}

export function getUniqueValues(
  auctions: Auction[],
  key: 'status' | 'tradingstatus',
): string[] {
  const set = new Set<string>();
  for (const item of auctions) {
    const val = item[key];
    if (val) set.add(String(val));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function toggleSort(
  currentKey: AuctionSortKey,
  currentDir: SortDirection,
  nextKey: AuctionSortKey,
): { sortKey: AuctionSortKey; sortDir: SortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: nextKey,
      sortDir: currentDir === 'asc' ? 'desc' : 'asc',
    };
  }
  const defaultDir: SortDirection = nextKey === 'TradeDate' ? 'desc' : 'asc';
  return { sortKey: nextKey, sortDir: defaultDir };
}
