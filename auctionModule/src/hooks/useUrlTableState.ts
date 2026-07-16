import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AuctionSortKey, AuctionTableState, SortDirection } from '@/types/auction';

const SORT_KEYS: AuctionSortKey[] = [
  'SecCode',
  'TradeDate',
  'status',
  'tradingstatus',
  'waprice',
  'starttime',
  'endtime',
];

function parseSortKey(value: string | null, fallback: AuctionSortKey): AuctionSortKey {
  if (value && SORT_KEYS.includes(value as AuctionSortKey)) {
    return value as AuctionSortKey;
  }
  return fallback;
}

function parseSortDir(value: string | null, fallback: SortDirection): SortDirection {
  if (value === 'desc') return 'desc';
  if (value === 'asc') return 'asc';
  return fallback;
}

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function useUrlTableState(defaultState: AuctionTableState) {
  const [searchParams, setSearchParams] = useSearchParams();

  const tableState = useMemo<AuctionTableState>(
    () => ({
      search: searchParams.get('q') ?? defaultState.search,
      statusFilter: searchParams.get('status') ?? defaultState.statusFilter,
      tradingStatusFilter: searchParams.get('trading') ?? defaultState.tradingStatusFilter,
      sortKey: parseSortKey(searchParams.get('sort'), defaultState.sortKey),
      sortDir: parseSortDir(searchParams.get('dir'), defaultState.sortDir),
      page: parsePage(searchParams.get('page')),
      pageSize: defaultState.pageSize,
    }),
    [searchParams, defaultState],
  );

  const todayOnly = searchParams.get('today') === '1';

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value == null || value === '') {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setTableState = useCallback(
    (updater: AuctionTableState | ((prev: AuctionTableState) => AuctionTableState)) => {
      const next = typeof updater === 'function' ? updater(tableState) : updater;
      updateParams({
        q: next.search || null,
        status: next.statusFilter || null,
        trading: next.tradingStatusFilter || null,
        sort: next.sortKey === defaultState.sortKey ? null : next.sortKey,
        dir: next.sortDir === defaultState.sortDir ? null : next.sortDir,
        page: next.page > 1 ? String(next.page) : null,
      });
    },
    [tableState, updateParams, defaultState.sortKey, defaultState.sortDir],
  );

  const setTodayOnly = useCallback(
    (value: boolean) => {
      updateParams({ today: value ? '1' : null });
    },
    [updateParams],
  );

  const setDebouncedSearch = useCallback(
    (value: string) => {
      updateParams({ q: value || null, page: null });
    },
    [updateParams],
  );

  return {
    tableState,
    setTableState,
    todayOnly,
    setTodayOnly,
    setDebouncedSearch,
    debouncedSearch: tableState.search,
  };
}
