import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { ErrorState } from '@/components/common/ErrorState';
import { LiveIndicator } from '@/components/common/LiveIndicator';
import { PageLoader } from '@/components/common/PageLoader';
import {
  getLatestPreliminaryCalculation,
  getPreliminaryCalculationHistory,
  savePreliminaryCalculation,
} from '@/api/auctions';
import { ReportsPanel } from '@/components/reports/ReportsPanel';
import { useAuth } from '@/auth/AuthContext';
import { useAuctionDetail } from '@/hooks/useAuctionDetail';
import { isMinfinRole } from '@/types/auth';
import type { BuyOrder, PreliminaryCalculation } from '@/types/auction';
import {
  buildTriOrdersContent,
  calculateAllocation,
  filterOrdersByCutOffPrice,
  formatVolume,
  mapOrdersToStatementRows,
  NON_COMPETITIVE_SHARE,
  round4,
  sortOrdersByYieldAsc,
  summarizeAllocationRows,
  toWholeBonds,
} from '@/utils/allocation';
import { downloadCsv } from '@/utils/download';
import { encodeWin1251 } from '@/utils/encodeWin1251';
import { formatDate, formatPrice } from '@/utils/format';
import { isAuctionActive } from '@/utils/auctionStatus';
import { isExecutedOrderState } from '@/utils/orderState';
import { computePriceYieldStats } from '@/utils/priceYieldStats';
import styles from './AuctionDetailPage.module.css';

const DETAIL_TABS = ['summary', 'priceYield', 'statements', 'reports', 'trades'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function getOrderRowClass(order: BuyOrder): string | undefined {
  if (order.isActive) return undefined;
  if (isExecutedOrderState(order.state)) return styles.executedRow;
  return styles.inactiveRow;
}
function parseDetailTab(value: string | null): DetailTab {
  if (value && DETAIL_TABS.includes(value as DetailTab)) return value as DetailTab;
  return 'summary';
}

export default function AuctionDetailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isMinfinUser = isMinfinRole(user?.role);
  const isAdminUser = user?.role === 'admin';
  const activeTab = isMinfinUser ? 'reports' : parseDetailTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: DetailTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'summary') next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [offeredQtyInput, setOfferedQtyInput] = useState('');
  const [cutOffPriceInput, setCutOffPriceInput] = useState('');
  const [savedCalculation, setSavedCalculation] = useState<PreliminaryCalculation | null>(null);
  const [calculationHistory, setCalculationHistory] = useState<PreliminaryCalculation[]>([]);
  const [savingPreliminary, setSavingPreliminary] = useState(false);
  const [preliminaryNotice, setPreliminaryNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const { auctionId } = useParams<{ auctionId: string }>();
  const {
    auction,
    buyOrders,
    trades,
    newOrderNotice,
    loading,
    error,
    notFound,
    lastUpdatedAt,
    refresh,
    clearNewOrderNotice,
  } = useAuctionDetail(auctionId);

  useEffect(() => {
    if (!isMinfinUser) return;
    if (searchParams.get('tab') === 'reports') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'reports');
        return next;
      },
      { replace: true },
    );
  }, [isMinfinUser, searchParams, setSearchParams]);

  const toNumber = (value: string | null | undefined): number => {
    if (value == null || value === '') return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatNumeric = (value: string | null | undefined): string => {
    const num = toNumber(value);
    if (num === 0) return '0';
    return num.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  const issueSize = toNumber(auction?.issuesize);
  const couponValue = toNumber(auction?.couponvalue);
  const faceValue = toNumber(
    (auction?.facevalue as string | null | undefined) ??
      (auction?.FACEVALUE as string | null | undefined) ??
      (auction?.sec_face_value as string | null | undefined),
  );

  const visibleBuyOrders = useMemo(
    () => buyOrders.filter((order) => order.isReportable || order.isActive),
    [buyOrders],
  );

  const activeBuyOrders = useMemo(
    () => visibleBuyOrders.filter((order) => order.isActive),
    [visibleBuyOrders],
  );

  const reportBuyOrders = useMemo(
    () => buyOrders.filter((order) => order.isReportable),
    [buyOrders],
  );

  const competitiveTotals = visibleBuyOrders.reduce(
    (acc, row) => {
      if (row.price > 0) {
        acc.quantity += row.quantity;
        acc.amount += row.amount;
      }
      return acc;
    },
    { quantity: 0, amount: 0 },
  );

  const nonCompetitiveTotals = visibleBuyOrders.reduce(
    (acc, row) => {
      if (row.price === 0) {
        acc.quantity += row.quantity;
        acc.amount += row.amount;
      }
      return acc;
    },
    { quantity: 0, amount: 0 },
  );
  const competitiveOrders = useMemo(
    () => sortOrdersByYieldAsc(visibleBuyOrders.filter((order) => order.price > 0)),
    [visibleBuyOrders],
  );
  const nonCompetitiveOrders = useMemo(
    () => sortOrdersByYieldAsc(visibleBuyOrders.filter((order) => order.price === 0)),
    [visibleBuyOrders],
  );
  const totalOrders = competitiveTotals.quantity + nonCompetitiveTotals.quantity;
  const totalAmount = competitiveTotals.amount + nonCompetitiveTotals.amount;

  const tradeTotals = useMemo(() => {
    const seenTradeIds = new Set<string>();
    return trades.reduce(
      (acc, trade) => {
        // У сделки две стороны с одним TradeNum — учитываем объём один раз.
        if (trade.tradeId) {
          if (seenTradeIds.has(trade.tradeId)) return acc;
          seenTradeIds.add(trade.tradeId);
        }
        acc.quantity += trade.quantity;
        acc.amount += trade.amount;
        return acc;
      },
      { quantity: 0, amount: 0 },
    );
  }, [trades]);

  const offeredQty = useMemo(() => {
    const parsed = Number.parseFloat(offeredQtyInput.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return issueSize > 0 ? issueSize : 0;
  }, [offeredQtyInput, issueSize]);

  const cutOffPrice = useMemo(() => {
    const parsed = Number.parseFloat(cutOffPriceInput.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [cutOffPriceInput]);

  const preliminaryBuyOrders = useMemo(
    () => filterOrdersByCutOffPrice(activeBuyOrders, cutOffPrice),
    [activeBuyOrders, cutOffPrice],
  );

  const allocationRows = useMemo(
    () => calculateAllocation(activeBuyOrders, offeredQty, NON_COMPETITIVE_SHARE),
    [activeBuyOrders, offeredQty],
  );
  const preliminaryAllocationRows = useMemo(
    () => calculateAllocation(preliminaryBuyOrders, offeredQty, NON_COMPETITIVE_SHARE),
    [preliminaryBuyOrders, offeredQty],
  );
  const allocationRequested = preliminaryAllocationRows.reduce(
    (sum, row) => sum + row.requested,
    0,
  );
  const allocationDistributed = preliminaryAllocationRows.reduce(
    (sum, row) => sum + row.allocated,
    0,
  );
  const allocationCoverage =
    allocationRequested > 0 ? (allocationDistributed / allocationRequested) * 100 : 0;

  const preliminaryAllocationByOrderId = useMemo(
    () => new Map(preliminaryAllocationRows.map((row) => [row.orderId, row])),
    [preliminaryAllocationRows],
  );

  const preliminaryCompetitiveOrders = useMemo(
    () => sortOrdersByYieldAsc(preliminaryBuyOrders.filter((order) => order.price > 0)),
    [preliminaryBuyOrders],
  );
  const preliminaryNonCompetitiveOrders = useMemo(
    () => sortOrdersByYieldAsc(preliminaryBuyOrders.filter((order) => order.price === 0)),
    [preliminaryBuyOrders],
  );

  const competitiveAllocationRows = useMemo(
    () =>
      mapOrdersToStatementRows(
        preliminaryCompetitiveOrders,
        preliminaryAllocationByOrderId,
        'competitive',
      ),
    [preliminaryCompetitiveOrders, preliminaryAllocationByOrderId],
  );
  const nonCompetitiveAllocationRows = useMemo(
    () =>
      mapOrdersToStatementRows(
        preliminaryNonCompetitiveOrders,
        preliminaryAllocationByOrderId,
        'nonCompetitive',
      ),
    [preliminaryNonCompetitiveOrders, preliminaryAllocationByOrderId],
  );
  const competitiveAllocationTotals = useMemo(
    () => summarizeAllocationRows(competitiveAllocationRows),
    [competitiveAllocationRows],
  );
  const nonCompetitiveAllocationTotals = useMemo(
    () => summarizeAllocationRows(nonCompetitiveAllocationRows),
    [nonCompetitiveAllocationRows],
  );
  const totalAllocationTotals = useMemo(
    () =>
      summarizeAllocationRows([
        ...competitiveAllocationRows,
        ...nonCompetitiveAllocationRows,
      ]),
    [competitiveAllocationRows, nonCompetitiveAllocationRows],
  );

  const fulfilledDemand = useMemo(() => {
    const orderMap = new Map(activeBuyOrders.map((order) => [order.orderId, order]));

    return allocationRows.reduce(
      (acc, row) => {
        const order = orderMap.get(row.orderId);
        const fulfilledAmount =
          order && row.requested > 0 ? order.amount * (row.allocated / row.requested) : 0;

        if (row.type === 'competitive') {
          acc.competitive += fulfilledAmount;
        } else {
          acc.nonCompetitive += fulfilledAmount;
        }
        acc.total += fulfilledAmount;
        return acc;
      },
      { competitive: 0, nonCompetitive: 0, total: 0 },
    );
  }, [allocationRows, activeBuyOrders]);

  const priceYieldStats = useMemo(
    () =>
      computePriceYieldStats(visibleBuyOrders, {
        bid: toNumber(auction?.bid),
        offer: toNumber(auction?.offer),
        low: toNumber(auction?.low),
        high: toNumber(auction?.high),
        waprice: toNumber(auction?.waprice),
        last: toNumber(auction?.last),
        qty: toNumber(auction?.qty),
        value: toNumber(auction?.value),
      }),
    [visibleBuyOrders, auction],
  );

  const satisfactionAmount = useMemo(() => {
    const fromParams = toNumber(auction?.value);
    if (fulfilledDemand.total > 0) return fulfilledDemand.total;
    return fromParams;
  }, [fulfilledDemand.total, auction?.value]);

  const priceYieldRows = [
    {
      label: 'Минимальная цена:',
      value: formatNumeric(String(priceYieldStats.minPrice || 0)),
      yieldLabel: 'Минимальная доходность к погашению, %:',
      yieldValue: priceYieldStats.minYield.toFixed(2),
    },
    {
      label: 'Максимальная цена:',
      value: formatNumeric(String(priceYieldStats.maxPrice || 0)),
      yieldLabel: 'Максимальная доходность к погашению, %:',
      yieldValue: priceYieldStats.maxYield.toFixed(2),
    },
    {
      label: 'Средневзвешенная цена:',
      value: formatNumeric(String(priceYieldStats.avgPrice || 0)),
      yieldLabel: 'Средневзвешенная доходность к погашению, %:',
      yieldValue: priceYieldStats.avgYield.toFixed(2),
    },
  ];

  const lastPriceDisplay =
    toNumber(auction?.last) > 0
      ? formatPrice(auction?.last)
      : priceYieldStats.avgPrice > 0
        ? formatNumeric(String(priceYieldStats.avgPrice))
        : '0.00';

  useEffect(() => {
    if (!auctionId) return;

    let cancelled = false;

    const loadSaved = async () => {
      try {
        const history = await getPreliminaryCalculationHistory(auctionId);
        if (cancelled) return;

        setCalculationHistory(history);
        const latest = history[0] ?? null;
        if (latest) {
          setSavedCalculation(latest);
          setOfferedQtyInput(String(latest.offeredQty));
          if (latest.cutOffPrice != null && latest.cutOffPrice > 0) {
            setCutOffPriceInput(String(latest.cutOffPrice));
          }
        }
      } catch {
        if (cancelled) return;
        try {
          const latest = await getLatestPreliminaryCalculation(auctionId);
          if (cancelled) return;
          if (latest) {
            setSavedCalculation(latest);
            setCalculationHistory([latest]);
            setOfferedQtyInput(String(latest.offeredQty));
            if (latest.cutOffPrice != null && latest.cutOffPrice > 0) {
              setCutOffPriceInput(String(latest.cutOffPrice));
            }
          }
        } catch {
          // Не очищаем уже показанные данные при сетевой ошибке повторной загрузки
        }
      }
    };

    void loadSaved();

    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  const applyHistoryCalculation = useCallback((calculation: PreliminaryCalculation) => {
    setSavedCalculation(calculation);
    setOfferedQtyInput(String(calculation.offeredQty));
    setCutOffPriceInput(
      calculation.cutOffPrice != null && calculation.cutOffPrice > 0
        ? String(calculation.cutOffPrice)
        : '',
    );
  }, []);
  const handleDownloadTri = () => {
    if (!auction) return;

    const triRows = [...competitiveAllocationRows, ...nonCompetitiveAllocationRows];

    const triContent = buildTriOrdersContent({
      classCode: auction.ClassCode ?? 'unknown',
      secCode: auction.SecCode ?? 'unknown',
      rows: triRows,
      startTransId: 1,
    });

    const blob = new Blob([encodeWin1251(triContent)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCode = (auction.SecCode ?? 'auction').replace(/[^\w.-]/g, '_');
    a.href = url;
    a.download = `${safeCode}_${auction.auction_id ?? 'orders'}.tri`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPreliminaryCsv = () => {
    if (!auction) return;
    const rows = [
      ['Заявка', 'Тип', 'Цена', 'Доходность %', 'Запрошено', 'Распределено', 'Объем', 'Распр. объем', '% удовл.'],
      ...preliminaryAllocationRows.map((row) => [
        row.orderId,
        row.type === 'competitive' ? 'Конкурентная' : 'Неконкурентная',
        row.price.toFixed(4),
        row.yield.toFixed(4),
        toWholeBonds(row.requested),
        toWholeBonds(row.allocated),
        row.requestedValue,
        row.allocatedValue,
        row.fulfillmentRate.toFixed(2),
      ]),
    ];
    const safeCode = (auction.SecCode ?? 'auction').replace(/[^\w.-]/g, '_');
    downloadCsv(rows, `${safeCode}_preliminary.csv`);
  };

  const handlePrintPreliminary = () => {
    window.print();
  };

  const handleCalculatePreliminary = async () => {    if (!auction?.auction_id) return;

    if (preliminaryAllocationRows.length === 0 || offeredQty <= 0) {
      setPreliminaryNotice({
        type: 'error',
        text: 'Недостаточно данных для предварительного расчёта',
      });
      return;
    }

    setSavingPreliminary(true);
    setPreliminaryNotice(null);

    try {
      const saved = await savePreliminaryCalculation({
        auctionId: auction.auction_id,
        classCode: auction.ClassCode ?? '',
        secCode: auction.SecCode ?? '',
        tradeDate: auction.TradeDate ?? null,
        offeredQty,
        cutOffPrice: cutOffPrice > 0 ? cutOffPrice : undefined,
        requestedQty: allocationRequested,        distributedQty: allocationDistributed,
        coveragePct: round4(allocationCoverage),
        rows: preliminaryAllocationRows.map((row) => ({
          orderId: row.orderId,
          type: row.type,
          price: row.price,
          yield: row.yield,
          requested: row.requested,
          allocated: row.allocated,
          requestedValue: row.requestedValue,
          allocatedValue: row.allocatedValue,
          fulfillmentRate: row.fulfillmentRate,
        })),
      });

      setSavedCalculation(saved);
      setCalculationHistory((prev) => {
        const withoutDuplicate = prev.filter((item) => item.id !== saved.id);
        return [saved, ...withoutDuplicate];
      });      setPreliminaryNotice({
        type: 'success',
        text: 'Предварительные расчёты сохранены',
      });
    } catch (err) {
      setPreliminaryNotice({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Не удалось сохранить предварительные расчёты',
      });
    } finally {
      setSavingPreliminary(false);
    }
  };

  if (loading) {
    return <PageLoader message="Загрузка аукциона…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (notFound || !auction) {
    return (
      <div className={styles.notFound}>
        <h2 className={styles.notFoundTitle}>Аукцион не найден</h2>
        <p className={styles.notFoundText}>
          Аукцион с идентификатором «{auctionId}» не существует или был удалён.
        </p>
        <Link to="/">
          <Button variant="primary">К списку</Button>
        </Link>
      </div>
    );
  }

  if (isMinfinUser) {
    return (
      <div className={styles.page}>
        <Breadcrumbs
          items={[
            { label: 'Список ведомостей', to: '/' },
            { label: auction.SecCode ?? auction.auction_id ?? 'Аукцион' },
          ]}
        />
        <div className={styles.topBar}>
          <Link to="/">
            <Button variant="secondary" size="sm">
              ← К списку
            </Button>
          </Link>
          <div className={styles.topBarMain}>
            <h1 className={styles.title}>
              Ведомости — {auction.SecCode ?? auction.auction_id}
            </h1>
            <LiveIndicator
              active={isAuctionActive(auction)}
              lastUpdatedAt={lastUpdatedAt}
              auction={auction}
            />
          </div>
        </div>
        <section className={styles.tabsSection}>
          <div className={styles.content}>
            <ReportsPanel
              auction={auction}
              buyOrders={reportBuyOrders}
              trades={trades}
              isMinfin
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Breadcrumbs
        items={[
          { label: 'Список аукционов', to: '/' },
          { label: auction.SecCode ?? auction.auction_id ?? 'Аукцион' },
        ]}
      />
      <div className={styles.topBar}>
        <Link to="/">
          <Button variant="secondary" size="sm">
            ← К списку
          </Button>
        </Link>
        <div className={styles.topBarMain}>
          <h1 className={styles.title}>Детали аукциона ГЦБ</h1>
          <LiveIndicator
            active={isAuctionActive(auction)}
            lastUpdatedAt={lastUpdatedAt}
            auction={auction}
          />
        </div>
      </div>
      <section className={styles.orders}>
        <h2 className={styles.sectionHeader}>Приказы на покупку</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Инструмент</th>
                <th>Цена</th>
                <th>Количество</th>
                <th>Сумма</th>
                <th>Желаемый доход (%)</th>
                <th>Дилер</th>
                <th>Счет</th>
                <th>Статус</th>
                <th>Выставлено</th>
              </tr>
            </thead>
            <tbody>
              <tr className={styles.groupRow}>
                <td colSpan={9}>Конкурентные</td>
              </tr>
              {competitiveOrders.length > 0 ? (
                competitiveOrders.map((order: BuyOrder, index) => (
                  <tr
                    key={order.orderId || `${order.instrument}-${index}`}
                    className={getOrderRowClass(order)}
                  >
                    <td>{order.instrument}</td>
                    <td className={styles.mono}>{order.price.toFixed(4)}</td>
                    <td className={styles.mono}>{order.quantity.toLocaleString('ru-RU')}</td>
                    <td className={styles.mono}>{order.amount.toLocaleString('ru-RU')}</td>
                    <td className={styles.mono}>{order.desiredYield.toFixed(4)}</td>
                    <td>{order.firmName || '—'}</td>
                    <td>{order.account}</td>
                    <td>{order.state}</td>
                    <td>{order.submittedAt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className={styles.emptyRow}>
                    Нет заявок на покупку по текущим данным аукциона
                  </td>
                </tr>
              )}
              <tr>
                <td>Итого:</td>
                <td />
                <td className={styles.mono}>{competitiveTotals.quantity.toLocaleString('ru-RU')}</td>
                <td className={styles.mono}>{competitiveTotals.amount.toLocaleString('ru-RU')}</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
              <tr className={styles.groupRow}>
                <td colSpan={9}>Не конкурентные</td>
              </tr>
              {nonCompetitiveOrders.length > 0 ? (
                nonCompetitiveOrders.map((order: BuyOrder, index) => (
                  <tr
                    key={order.orderId || `non-competitive-${order.instrument}-${index}`}
                    className={getOrderRowClass(order)}
                  >
                    <td>{order.instrument}</td>
                    <td className={styles.mono}>{order.price.toFixed(4)}</td>
                    <td className={styles.mono}>{order.quantity.toLocaleString('ru-RU')}</td>
                    <td className={styles.mono}>{order.amount.toLocaleString('ru-RU')}</td>
                    <td className={styles.mono}>0.0000</td>
                    <td>{order.firmName || '—'}</td>
                    <td>{order.account}</td>
                    <td>{order.state}</td>
                    <td>{order.submittedAt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className={styles.emptyRow}>
                    Нет не конкурентных заявок
                  </td>
                </tr>
              )}
              <tr>
                <td>Итого:</td>
                <td />
                <td className={styles.mono}>{nonCompetitiveTotals.quantity.toLocaleString('ru-RU')}</td>
                <td className={styles.mono}>{nonCompetitiveTotals.amount.toLocaleString('ru-RU')}</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
              <tr>
                <td>Общий итог:</td>
                <td />
                <td className={styles.mono}>{totalOrders.toLocaleString('ru-RU')}</td>
                <td className={styles.mono}>{totalAmount.toLocaleString('ru-RU')}</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>            </tbody>
          </table>
        </div>
      </section>

      {newOrderNotice &&
        createPortal(
          <div className={styles.toastStack}>
            <div className={`${styles.toast} ${styles.toastSuccess}`}>
              <div className={styles.toastIcon}>✓</div>
              <div className={styles.toastBody}>
                <div className={styles.toastTitle}>Новая заявка на покупку</div>
                <div className={styles.toastText}>{newOrderNotice}</div>
              </div>
              <button
                type="button"
                className={styles.toastClose}
                onClick={clearNewOrderNotice}
                aria-label="Закрыть уведомление"
              >
                ×
              </button>
            </div>
          </div>,
          document.body,
        )}

      <section className={styles.tabsSection}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Общая информация
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'priceYield' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('priceYield')}
          >
            Цена и доходность
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'statements' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('statements')}
          >
            Предварительные расчёты
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'reports' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Ведомости
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'trades' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('trades')}
          >
            Сделки
          </button>
        </div>

        {activeTab === 'summary' && (
          <div className={styles.content}>
            <div className={styles.infoCols}>
              <div className={styles.infoBlock}>
                <div className={styles.infoRow}>
                  <span>Код:</span>
                  <span className={styles.infoValue}>{auction.SecCode ?? '—'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Дата пересчета:</span>
                  <span className={styles.infoValue}>{formatDate(auction.TradeDate)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Дата закрытия:</span>
                  <span className={styles.infoValue}>
                    {auction.endtime?.slice(0, 8) ?? '—'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span>Объем эмиссии:</span>
                  <span className={styles.infoValue}>{formatNumeric(auction.issuesize)}</span>
                </div>
                <div className={styles.infoRow}>
                  <span>Не конкурентных (%):</span>
                  <span className={styles.infoValue}>{formatNumeric(auction.yield)}</span>
                </div>
              </div>
              <div className={styles.infoBlock}>
                <div className={styles.infoRow}>
                  <span>Объем спроса (сом):</span>
                  <span className={styles.infoValue}>
                    {formatNumeric(String(totalAmount))}
                  </span>
                </div>
                <div className={styles.infoSubRow}>
                  <span>Конкур-е:</span>
                  <span className={styles.infoValue}>
                    {formatNumeric(String(competitiveTotals.amount))}
                  </span>
                </div>
                <div className={styles.infoSubRow}>
                  <span>Неконкур-е:</span>
                  <span className={styles.infoValue}>
                    {formatNumeric(String(nonCompetitiveTotals.amount))}
                  </span>
                </div>
                <div className={styles.separator} />
                <div className={styles.infoRow}>
                  <span>Объем удовлетв. спрос (сом):</span>
                  <span className={styles.infoValue}>
                    {formatNumeric(String(fulfilledDemand.total))}
                  </span>
                </div>
                <div className={styles.infoSubRow}>
                  <span>Конкур-е:</span>
                  <span className={styles.infoValue}>
                    {formatNumeric(String(fulfilledDemand.competitive))}
                  </span>
                </div>
                <div className={styles.infoSubRow}>
                  <span>Неконкур-е:</span>
                  <span className={styles.infoValue}>
                    {formatNumeric(String(fulfilledDemand.nonCompetitive))}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.footerBar}>
              Статус: {auction.status ?? 'Закрыт'} ({auction.tradingstatus ?? 'ожидает предварительных расчетов'})
            </div>
          </div>
        )}

        {activeTab === 'priceYield' && (
          <div className={styles.content}>
            <div className={styles.priceYieldCols}>
              <div className={styles.infoBlockWide}>
                {priceYieldRows.map((row) => (
                  <div className={styles.infoRow} key={row.label}>
                    <span>{row.label}</span>
                    <span className={styles.infoValue}>{row.value}</span>
                    <span>{row.yieldLabel}</span>
                    <span className={styles.infoValue}>{row.yieldValue}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Купон</span>
                <span className={styles.metaValue}>{formatPrice(auction.couponvalue)}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Период купона</span>
                <span className={styles.metaValue}>
                  {auction.couponperiod ? `${auction.couponperiod} дн.` : '—'}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Объем выпуска</span>
                <span className={styles.metaValue}>{issueSize.toLocaleString('ru-RU')}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Лот</span>
                <span className={styles.metaValue}>{auction.lotsize ?? '—'}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Объем спроса (сом)</span>
                <span className={styles.metaValue}>
                  {priceYieldStats.demandAmount.toLocaleString('ru-RU', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Объем спроса (шт.)</span>
                <span className={styles.metaValue}>
                  {toWholeBonds(priceYieldStats.demandQuantity).toLocaleString('ru-RU')}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Объем удовлетворения (сом)</span>
                <span className={styles.metaValue}>
                  {satisfactionAmount.toLocaleString('ru-RU', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Последняя цена</span>
                <span className={styles.metaValue}>{lastPriceDisplay}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Класс инструмента</span>
                <span className={styles.metaValue}>{auction.ClassCode ?? '—'}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Код инструмента</span>
                <span className={styles.metaValue}>{auction.SecCode ?? '—'}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Номинал купона</span>
                <span className={styles.metaValue}>
                  {(faceValue > 0 ? faceValue : couponValue).toLocaleString('ru-RU')}
                </span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Сделок</span>
                <span className={styles.metaValue}>{auction.numtrades ?? '0'}</span>
              </div>
            </div>

            <div className={styles.footerBar}>
              Статус: {auction.status ?? 'Закрыт'} ({auction.tradingstatus ?? 'ожидает предварительных расчетов'})
            </div>
          </div>
        )}

        {activeTab === 'statements' && (
          <div className={styles.content}>
            <div className={styles.calcControls}>
              <div className={styles.calcField}>
                <label className={styles.calcLabel} htmlFor="offeredQty">
                  Объем продажи (N):
                </label>
                <input
                  id="offeredQty"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={offeredQtyInput}
                  onChange={(event) => setOfferedQtyInput(event.target.value)}
                  className={styles.calcInput}
                  placeholder={issueSize > 0 ? String(issueSize) : 'Введите N'}
                />
                <div className={styles.calcHint}>
                  По умолчанию используется объем эмиссии: {issueSize.toLocaleString('ru-RU')}
                </div>
              </div>
              <div className={styles.calcField}>
                <label className={styles.calcLabel} htmlFor="cutOffPrice">
                  Цена отсечения:
                </label>
                <input
                  id="cutOffPrice"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={cutOffPriceInput}
                  onChange={(event) => setCutOffPriceInput(event.target.value)}
                  className={styles.calcInput}
                  placeholder="Минимальный порог цены"
                />
                <div className={styles.calcHint}>
                  В расчёт попадают только заявки с ценой выше порога
                </div>
              </div>
              <div className={styles.calcActions}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCalculatePreliminary}
                  loading={savingPreliminary}
                  disabled={preliminaryAllocationRows.length === 0 || offeredQty <= 0}
                >
                  Посчитать предварительные расчёты
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadTri}
                  disabled={allocationDistributed <= 0}
                >
                  Скачать .tri
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadPreliminaryCsv}
                  disabled={preliminaryAllocationRows.length === 0}
                >
                  Скачать CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrintPreliminary}
                  disabled={preliminaryAllocationRows.length === 0}
                >
                  Печать
                </Button>
              </div>
            </div>

            {calculationHistory.length > 0 && (
              <div className={styles.historyPanel}>
                <div className={styles.historyTitle}>История расчётов</div>
                <div className={styles.historyList}>
                  {calculationHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.historyItem} ${
                        savedCalculation?.id === item.id ? styles.historyItemActive : ''
                      }`}
                      onClick={() => applyHistoryCalculation(item)}
                    >
                      <span>{new Date(item.createdAt).toLocaleString('ru-RU')}</span>
                      <span>
                        N={item.offeredQty.toLocaleString('ru-RU')}
                        {item.cutOffPrice != null && item.cutOffPrice > 0
                          ? ` · отсечение ${item.cutOffPrice}`
                          : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {preliminaryNotice && (
              <div
                className={
                  preliminaryNotice.type === 'error'
                    ? styles.calcNoticeError
                    : styles.calcNotice
                }
              >
                {preliminaryNotice.text}
              </div>
            )}
            {savedCalculation && (
              <div className={styles.calcSavedAt}>
                Последнее сохранение:{' '}
                {new Date(savedCalculation.createdAt).toLocaleString('ru-RU')}
              </div>
            )}

            <div className={`${styles.preliminaryPrintArea} report-print-root`}>
              <div className={styles.preliminaryPrintHeader}>
                <h3>Предварительные расчёты — {auction.SecCode ?? auction.auction_id}</h3>
                <div>{new Date().toLocaleString('ru-RU')}</div>
              </div>

            <div className={styles.calcStats}>
              <div>Спрос: {round4(allocationRequested).toLocaleString('ru-RU')}</div>
              <div>Предложение (N): {toWholeBonds(offeredQty).toLocaleString('ru-RU')}</div>
              <div>
                Цена отсечения:{' '}
                {cutOffPrice > 0 ? cutOffPrice.toLocaleString('ru-RU') : 'не задана'}
              </div>
              <div>Распределено: {toWholeBonds(allocationDistributed).toLocaleString('ru-RU')}</div>
              <div>Удовлетворение спроса: {round4(allocationCoverage).toFixed(2)}%</div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Заявка</th>
                    <th>Тип</th>
                    <th>Цена</th>
                    <th>Доходность, %</th>
                    <th>Запрошено</th>
                    <th>Распределено</th>
                    <th>Объем</th>
                    <th>Распр. объем</th>
                    <th>% удовл.</th>
                  </tr>
                </thead>
                <tbody>
                  {preliminaryBuyOrders.length > 0 ? (
                    <>
                      <tr className={styles.groupRow}>
                        <td colSpan={9}>Конкурентные</td>
                      </tr>
                      {competitiveAllocationRows.length > 0 ? (
                        competitiveAllocationRows.map((row) => (
                          <tr key={`alloc-${row.orderId}`}>
                            <td>{row.orderId}</td>
                            <td>Конкурентная</td>
                            <td className={styles.mono}>{row.price.toFixed(4)}</td>
                            <td className={styles.mono}>{row.yield.toFixed(4)}</td>
                            <td className={styles.mono}>
                              {toWholeBonds(row.requested).toLocaleString('ru-RU')}
                            </td>
                            <td className={styles.mono}>
                              {toWholeBonds(row.allocated).toLocaleString('ru-RU')}
                            </td>
                            <td className={styles.mono}>{formatVolume(row.requestedValue)}</td>
                            <td className={styles.mono}>{formatVolume(row.allocatedValue)}</td>
                            <td className={styles.mono}>{row.fulfillmentRate.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className={styles.emptyRow}>
                            Нет конкурентных заявок
                          </td>
                        </tr>
                      )}

                      <tr className={styles.groupRow}>
                        <td colSpan={9}>Неконкурентные</td>
                      </tr>
                      {nonCompetitiveAllocationRows.length > 0 ? (
                        nonCompetitiveAllocationRows.map((row) => (
                          <tr key={`alloc-${row.orderId}`}>
                            <td>{row.orderId}</td>
                            <td>Неконкурентная</td>
                            <td className={styles.mono}>{row.price.toFixed(4)}</td>
                            <td className={styles.mono}>{row.yield.toFixed(4)}</td>
                            <td className={styles.mono}>
                              {toWholeBonds(row.requested).toLocaleString('ru-RU')}
                            </td>
                            <td className={styles.mono}>
                              {toWholeBonds(row.allocated).toLocaleString('ru-RU')}
                            </td>
                            <td className={styles.mono}>{formatVolume(row.requestedValue)}</td>
                            <td className={styles.mono}>{formatVolume(row.allocatedValue)}</td>
                            <td className={styles.mono}>{row.fulfillmentRate.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className={styles.emptyRow}>
                            Нет неконкурентных заявок
                          </td>
                        </tr>
                      )}

                      {competitiveAllocationTotals.count > 0 && (
                        <tr>
                          <td>Итого конкурентные:</td>
                          <td className={styles.mono}>{competitiveAllocationTotals.count}</td>
                          <td />
                          <td />
                          <td className={styles.mono}>
                            {toWholeBonds(competitiveAllocationTotals.requested).toLocaleString('ru-RU')}
                          </td>
                          <td className={styles.mono}>
                            {toWholeBonds(competitiveAllocationTotals.allocated).toLocaleString('ru-RU')}
                          </td>
                          <td className={styles.mono}>
                            {formatVolume(competitiveAllocationTotals.requestedValue)}
                          </td>
                          <td className={styles.mono}>
                            {formatVolume(competitiveAllocationTotals.allocatedValue)}
                          </td>
                          <td className={styles.mono}>
                            {competitiveAllocationTotals.fulfillmentRate.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {nonCompetitiveOrders.length > 0 && (
                        <tr>
                          <td>Итого неконкурентные:</td>
                          <td className={styles.mono}>{nonCompetitiveAllocationTotals.count}</td>
                          <td />
                          <td />
                          <td className={styles.mono}>
                            {toWholeBonds(nonCompetitiveAllocationTotals.requested).toLocaleString('ru-RU')}
                          </td>
                          <td className={styles.mono}>
                            {toWholeBonds(nonCompetitiveAllocationTotals.allocated).toLocaleString('ru-RU')}
                          </td>
                          <td className={styles.mono}>
                            {formatVolume(nonCompetitiveAllocationTotals.requestedValue)}
                          </td>
                          <td className={styles.mono}>
                            {formatVolume(nonCompetitiveAllocationTotals.allocatedValue)}
                          </td>
                          <td className={styles.mono}>
                            {nonCompetitiveAllocationTotals.fulfillmentRate.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td>Общий итог:</td>
                        <td className={styles.mono}>{totalAllocationTotals.count}</td>
                        <td />
                        <td />
                        <td className={styles.mono}>
                          {toWholeBonds(totalAllocationTotals.requested).toLocaleString('ru-RU')}
                        </td>
                        <td className={styles.mono}>
                          {toWholeBonds(totalAllocationTotals.allocated).toLocaleString('ru-RU')}
                        </td>
                        <td className={styles.mono}>
                          {formatVolume(totalAllocationTotals.requestedValue)}
                        </td>
                        <td className={styles.mono}>
                          {formatVolume(totalAllocationTotals.allocatedValue)}
                        </td>
                        <td className={styles.mono}>
                          {totalAllocationTotals.fulfillmentRate.toFixed(2)}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>
                        Недостаточно данных для предварительного расчета
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className={styles.content}>
            <ReportsPanel
              auction={auction}
              buyOrders={reportBuyOrders}
              trades={trades}
              isMinfin={isMinfinUser}
              isAdmin={isAdminUser}
            />
          </div>
        )}
        {activeTab === 'trades' && (
          <div className={styles.content}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>№ сделки</th>
                    <th>Инструмент</th>
                    <th>Цена</th>
                    <th>Количество</th>
                    <th>Сумма</th>
                    <th>Доходность (%)</th>
                    <th>Дилер</th>
                    <th>Счет</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length > 0 ? (
                    <>
                      {trades.map((trade, index) => (
                        <tr key={trade.tradeId || `${trade.instrument}-${index}`}>
                          <td>{trade.tradeId || '—'}</td>
                          <td>{trade.instrument}</td>
                          <td className={styles.mono}>{trade.price.toFixed(4)}</td>
                          <td className={styles.mono}>{trade.quantity.toLocaleString('ru-RU')}</td>
                          <td className={styles.mono}>{trade.amount.toLocaleString('ru-RU')}</td>
                          <td className={styles.mono}>{trade.yieldValue.toFixed(4)}</td>
                          <td>{trade.dealerName || trade.firmName || '—'}</td>
                          <td>{trade.account}</td>
                          <td>{trade.tradedAt}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>Итого:</td>
                        <td />
                        <td />
                        <td className={styles.mono}>
                          {tradeTotals.quantity.toLocaleString('ru-RU')}
                        </td>
                        <td className={styles.mono}>
                          {tradeTotals.amount.toLocaleString('ru-RU')}
                        </td>
                        <td />
                        <td />
                        <td />
                        <td />
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={9} className={styles.emptyRow}>
                        Нет сделок по текущим данным аукциона
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
