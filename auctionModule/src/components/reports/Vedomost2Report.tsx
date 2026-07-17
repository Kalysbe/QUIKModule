import { useEffect, useMemo, useState } from 'react';
import type { Auction, BuyOrder, Trade } from '@/types/auction';
import {
  getAuctions,
  getLatestPreliminaryCalculation,
  getOrdersByInstrument,
  getTradesByInstrument,
} from '@/api/auctions';
import { formatReportMoney, formatReportPercent, formatShortDate } from '@/utils/format';
import { downloadCsv } from '@/utils/download';
import { resolveOrderQuantity } from '@/utils/allocation';
import { isReportableOrderState } from '@/utils/orderState';
import {
  buildVedomost2Report,
  computeVedomost2Metrics,
  findPreviousAuction,
  type AuctionComparisonMetrics,
  type PlacementBlock,
} from './buildVedomost2Report';
import styles from './Vedomost2Report.module.css';

interface Vedomost2ReportProps {
  auction: Auction;
  buyOrders: BuyOrder[];
  trades?: Trade[];
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOrderYieldFromApi(price: number, yieldValue: number): number {
  if (yieldValue > 0) return yieldValue;
  if (price > 0) return Math.max(0, 100 - price);
  return 0;
}

async function loadBuyOrders(target: Auction): Promise<BuyOrder[]> {
  if (!target.ClassCode || !target.SecCode) return [];
  const orders = await getOrdersByInstrument(
    target.ClassCode,
    target.SecCode,
    target.TradeDate,
  );

  return orders
    .filter((order) => {
      const operation = (order.Operation ?? '').toLowerCase();
      return operation.includes('куп');
    })
    .map((order) => {
      const price = toNumber(order.Price);
      const yieldValue = toNumber(order.Yield);
      const state = order.State?.trim() || '—';

      const amount = toNumber(order.Value);
      return {
        orderId: order.OrderNum ?? '',
        instrument: order.SecCode ?? target.SecCode ?? '—',
        price,
        quantity: resolveOrderQuantity(toNumber(order.Qty), amount, price),
        amount,
        desiredYield: getOrderYieldFromApi(price, yieldValue),
        account: order.TradingAccount ?? order.Account ?? '—',
        firmName: order.FirmName?.trim() || '',
        dealerName:
          order.ClientName?.trim() ||
          order.Comment?.trim() ||
          order.ClientCode?.trim() ||
          order.TradingAccount?.trim() ||
          order.Account?.trim() ||
          '—',
        submittedAt: order.OrderDateTime ?? '—',
        state,
        isActive: true,
        isReportable: isReportableOrderState(order.State),
      };
    })
    .filter((order) => order.isReportable);
}

async function loadTrades(target: Auction): Promise<Trade[]> {
  if (!target.ClassCode || !target.SecCode) return [];
  const trades = await getTradesByInstrument(
    target.ClassCode,
    target.SecCode,
    target.TradeDate,
  );

  return trades.map((trade) => {
    const price = toNumber(trade.Price);
    const yieldValue = toNumber(trade.Yield);
    const amount = toNumber(trade.Value);
    return {
      tradeId: trade.TradeNum != null ? String(trade.TradeNum) : '',
      orderNum: trade.OrderNum != null ? String(trade.OrderNum) : '',
      instrument: trade.SecCode ?? target.SecCode ?? '—',
      price,
      quantity: resolveOrderQuantity(toNumber(trade.Qty), amount, price),
      amount,
      yieldValue: getOrderYieldFromApi(price, yieldValue),
      account: trade.TradingAccount ?? trade.Account ?? '—',
      firmName: trade.FirmName?.trim() || '',
      dealerName:
        trade.ClientName?.trim() ||
        trade.Comment?.trim() ||
        trade.ClientCode?.trim() ||
        trade.TradingAccount?.trim() ||
        trade.Account?.trim() ||
        '—',
      tradedAt: trade.TradeDateTime ?? trade.TradeDate ?? '—',
    };
  });
}

function formatDotDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return value;
  }
}

function formatOptional(value: number | null | undefined): string {
  if (value == null) return '';
  return formatReportMoney(value);
}

function PlacementRow({
  label,
  block,
  showPriceYield,
}: {
  label: string;
  block: PlacementBlock;
  showPriceYield: boolean;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td className={styles.numericCell}>{formatReportMoney(block.quantity)}</td>
      <td className={styles.numericCell}>{formatReportMoney(block.nominalValue)}</td>
      <td className={styles.numericCell}>{formatReportMoney(block.actualValue)}</td>
      <td className={styles.numericCell}>
        {showPriceYield ? formatOptional(block.weightedAveragePrice) : ''}
      </td>
      <td className={styles.numericCell}>
        {showPriceYield && block.yieldPercent != null
          ? formatReportPercent(block.yieldPercent)
          : ''}
      </td>
    </tr>
  );
}

export function Vedomost2Report({ auction, buyOrders, trades = [] }: Vedomost2ReportProps) {
  const [currentPreliminary, setCurrentPreliminary] = useState<
    Awaited<ReturnType<typeof getLatestPreliminaryCalculation>>
  >(null);
  const [previousMetrics, setPreviousMetrics] =
    useState<AuctionComparisonMetrics | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingExtra(true);
      try {
        const auctionId = String(auction.auction_id ?? auction.SecCode ?? '');
        const [preliminary, auctionsResponse] = await Promise.all([
          auctionId ? getLatestPreliminaryCalculation(auctionId) : Promise.resolve(null),
          getAuctions({ limit: 200, today: false }),
        ]);

        if (cancelled) return;
        setCurrentPreliminary(preliminary);

        const previousAuction = findPreviousAuction(auction, auctionsResponse.data ?? []);
        if (!previousAuction) {
          setPreviousMetrics(null);
          return;
        }

        const previousId = String(
          previousAuction.auction_id ?? previousAuction.SecCode ?? '',
        );
        const [previousOrders, previousPreliminary, previousTrades] = await Promise.all([
          loadBuyOrders(previousAuction),
          previousId
            ? getLatestPreliminaryCalculation(previousId)
            : Promise.resolve(null),
          loadTrades(previousAuction),
        ]);

        if (cancelled) return;
        setPreviousMetrics(
          computeVedomost2Metrics(previousAuction, previousOrders, previousTrades, {
            preliminary: previousPreliminary,
          }),
        );
      } catch {
        if (!cancelled) {
          setPreviousMetrics(null);
        }
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [auction]);

  const currentMetrics = useMemo(
    () =>
      computeVedomost2Metrics(auction, buyOrders, trades, {
        preliminary: currentPreliminary,
      }),
    [auction, buyOrders, trades, currentPreliminary],
  );

  const report = useMemo(
    () => buildVedomost2Report(currentMetrics, previousMetrics, auction.TradeDate),
    [currentMetrics, previousMetrics, auction.TradeDate],
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Сводная ведомость 2'],
      ['Дата', formatShortDate(report.reportDate)],
      [],
      [
        'Основа',
        'Кол-во ГЦБ',
        'Сумма по номиналу',
        'Сумма по факту',
        'Средневзвешенная цена',
        'Доходность',
      ],
      [
        'На конкурентной основе',
        report.current.competitive.quantity,
        report.current.competitive.nominalValue,
        report.current.competitive.actualValue,
        report.current.competitive.weightedAveragePrice ?? '',
        report.current.competitive.yieldPercent ?? '',
      ],
      [
        'На неконкурентной основе',
        report.current.nonCompetitive.quantity,
        report.current.nonCompetitive.nominalValue,
        report.current.nonCompetitive.actualValue,
        '',
        '',
      ],
      [
        'Всего',
        report.current.total.quantity,
        report.current.total.nominalValue,
        report.current.total.actualValue,
        '',
        '',
      ],
      [],
      [
        'Показатель',
        `Текущий аукцион ${report.current.secCode}`,
        report.previous
          ? `Предыдущий аукцион ${report.previous.secCode}`
          : 'Предыдущий аукцион',
        'Абсолютная разница',
      ],
      ...report.comparisonRows.map((row) => [
        row.label,
        row.current ?? '',
        row.previous ?? '',
        row.difference ?? '',
      ]),
    ];
    const safeCode = (auction.SecCode ?? 'report').replace(/[^\w.-]/g, '_');
    downloadCsv(rows, `${safeCode}_vedomost2.csv`);
  };

  return (
    <div className={`${styles.report} report-print-root`}>
      <div className={styles.printArea}>
        <div className={styles.header}>
          <h2 className={styles.title}>Сводная ведомость 2</h2>
          <div className={styles.reportDate}>
            Дата: {formatShortDate(report.reportDate)}
          </div>
        </div>

        <h3 className={styles.sectionTitle}>Итоги размещения:</h3>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>размещено:</th>
              <th>Кол-во ГЦБ (в штуках)</th>
              <th>Сумма удовлетворенных заявок (по номиналу, в сомах)</th>
              <th>Сумма удовлетворенных заявок (по факту, в сомах)</th>
              <th>Средневзвешенная цена (сом)</th>
              <th>Доходность (в %)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>На конкурентной основе</td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.competitive.quantity)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.competitive.nominalValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.competitive.actualValue)}
              </td>
              <td className={`${styles.numericCell} ${styles.mergedCenterCell}`} rowSpan={3}>
                {report.current.competitive.weightedAveragePrice != null
                  ? formatOptional(report.current.competitive.weightedAveragePrice)
                  : ''}
              </td>
              <td className={`${styles.numericCell} ${styles.mergedCenterCell}`} rowSpan={3}>
                {report.current.competitive.yieldPercent != null
                  ? formatReportPercent(report.current.competitive.yieldPercent)
                  : ''}
              </td>
            </tr>
            <tr>
              <td>На неконкурентной основе</td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.nonCompetitive.quantity)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.nonCompetitive.nominalValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.nonCompetitive.actualValue)}
              </td>
            </tr>
            <tr className={styles.totalRow}>
              <td>Всего:</td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.total.quantity)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.total.nominalValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.current.total.actualValue)}
              </td>
            </tr>
          </tbody>
        </table>

        <table className={`${styles.dataTable} ${styles.comparisonTable}`}>
          <thead>
            <tr>
              <th />
              <th>
                <div>Текущий аукцион</div>
                <div className={styles.metaLine}>{report.current.secCode}</div>
                <div className={styles.metaLine}>
                  {formatDotDate(report.current.tradeDate)}
                </div>
              </th>
              <th>
                <div>Предыдущий аукцион</div>
                <div className={styles.metaLine}>
                  {report.previous?.secCode ?? (loadingExtra ? '…' : '—')}
                </div>
                <div className={styles.metaLine}>
                  {report.previous
                    ? formatDotDate(report.previous.tradeDate)
                    : loadingExtra
                      ? '…'
                      : '—'}
                </div>
              </th>
              <th>Абсолютная разница</th>
            </tr>
          </thead>
          <tbody>
            {report.comparisonRows.map((row) => (
              <tr key={row.label}>
                <td className={styles.rowLabel}>{row.label}</td>
                <td className={styles.numericCell}>{formatOptional(row.current)}</td>
                <td className={styles.numericCell}>{formatOptional(row.previous)}</td>
                <td className={styles.numericCell}>{formatOptional(row.difference)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.printButton} onClick={handleDownloadCsv}>
          Скачать CSV
        </button>
        <button type="button" className={styles.printButton} onClick={handlePrint}>
          Распечатать отчет
        </button>
      </div>
    </div>
  );
}
