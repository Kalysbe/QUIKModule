import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuctionFilters } from '@/components/auction/AuctionFilters';
import { AuctionTable } from '@/components/auction/AuctionTable';
import { EmptyState } from '@/components/auction/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LiveIndicator } from '@/components/common/LiveIndicator';
import { PageLoader } from '@/components/common/PageLoader';
import { Pagination } from '@/components/ui/Pagination';
import { useAuctions } from '@/hooks/useAuctions';
import { useUrlTableState } from '@/hooks/useUrlTableState';
import { useAuth } from '@/auth/AuthContext';
import { isMinfinRole } from '@/types/auth';
import type { AuctionSortKey, AuctionTableState } from '@/types/auction';
import { getUniqueValues, processAuctionTable, toggleSort } from '@/utils/auctionTable';
import { isAuctionActive } from '@/utils/auctionStatus';
import styles from './HomePage.module.css';

const DEFAULT_STATE: AuctionTableState = {
  search: '',
  statusFilter: '',
  tradingStatusFilter: '',
  sortKey: 'TradeDate',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function HomePage() {
  const {
    tableState,
    setTableState,
    todayOnly,
    setTodayOnly,
    setDebouncedSearch,
    debouncedSearch,
  } = useUrlTableState(DEFAULT_STATE);
  const { user } = useAuth();
  const isMinfin = isMinfinRole(user?.role);
  const { auctions, loading, error, lastUpdatedAt, refresh } = useAuctions(todayOnly);

  const [draftSearch, setDraftSearch] = useState<string | null>(null);
  const displaySearch = draftSearch ?? debouncedSearch;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draftSearch != null && draftSearch !== debouncedSearch) {
        setDebouncedSearch(draftSearch);
        setDraftSearch(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draftSearch, debouncedSearch, setDebouncedSearch]);

  const statusOptions = useMemo(() => getUniqueValues(auctions, 'status'), [auctions]);
  const tradingStatusOptions = useMemo(
    () => getUniqueValues(auctions, 'tradingstatus'),
    [auctions],
  );

  const processed = useMemo(
    () => processAuctionTable(auctions, tableState),
    [auctions, tableState],
  );

  const hasActiveAuction = auctions.some((auction) => isAuctionActive(auction));

  const handleSort = useCallback(
    (key: AuctionSortKey) => {
      setTableState((s) => {
        const { sortKey, sortDir } = toggleSort(s.sortKey, s.sortDir, key);
        return { ...s, sortKey, sortDir };
      });
    },
    [setTableState],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setTableState((s) => ({ ...s, page }));
    },
    [setTableState],
  );

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      setTableState((s) => ({ ...s, statusFilter: value, page: 1 }));
    },
    [setTableState],
  );

  const handleTradingStatusFilterChange = useCallback(
    (value: string) => {
      setTableState((s) => ({ ...s, tradingStatusFilter: value, page: 1 }));
    },
    [setTableState],
  );

  if (loading && auctions.length === 0) {
    return <PageLoader skeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const isEmpty = auctions.length === 0;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <h2 className={styles.heroTitle}>
              {isMinfin
                ? 'Ведомости по аукционам государственных ценных бумаг'
                : 'Аукционы государственных ценных бумаг'}
            </h2>
            <p className={styles.heroSubtitle}>
              {isMinfin
                ? 'Выберите аукцион для просмотра и печати ведомостей'
                : 'Кыргызская фондовая биржа — актуальные торги ГЦБ в режиме реального времени'}
            </p>
          </div>
          <LiveIndicator active={hasActiveAuction} lastUpdatedAt={lastUpdatedAt} />
        </div>
      </section>

      {!isEmpty && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{auctions.length}</div>
            <div className={styles.statLabel}>Всего аукционов</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{processed.total}</div>
            <div className={styles.statLabel}>После фильтрации</div>
          </div>
        </div>
      )}

      <AuctionFilters
        search={displaySearch}
        onSearchChange={setDraftSearch}
        statusFilter={tableState.statusFilter}
        tradingStatusFilter={tableState.tradingStatusFilter}
        statusOptions={statusOptions}
        tradingStatusOptions={tradingStatusOptions}
        onStatusFilterChange={handleStatusFilterChange}
        onTradingStatusFilterChange={handleTradingStatusFilterChange}
        todayOnly={todayOnly}
        onTodayOnlyChange={setTodayOnly}
      />

      {isEmpty ? (
        <EmptyState todayOnly={todayOnly} />
      ) : processed.total === 0 ? (
        <EmptyState todayOnly={todayOnly} />
      ) : (
        <>
          <AuctionTable
            auctions={processed.items}
            sortKey={tableState.sortKey}
            sortDir={tableState.sortDir}
            onSort={handleSort}
            reportsOnly={isMinfin}
          />
          <Pagination
            page={processed.page}
            totalPages={processed.totalPages}
            total={processed.total}
            pageSize={tableState.pageSize}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
