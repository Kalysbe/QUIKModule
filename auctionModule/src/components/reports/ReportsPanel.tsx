import { useEffect, useMemo, useState } from 'react';
import type { Auction, BuyOrder, Trade } from '@/types/auction';
import { isAuctionActive } from '@/utils/auctionStatus';
import { CentralDepositoryReport } from './CentralDepositoryReport';
import { OrderClassificationReport } from './OrderClassificationReport';
import { SummaryBidsReport } from './SummaryBidsReport';
import { Vedomost2Report } from './Vedomost2Report';
import { getAvailableReportOptions, type ReportId } from './types';
import styles from './ReportsPanel.module.css';

interface ReportsPanelProps {
  auction: Auction;
  buyOrders: BuyOrder[];
  /** Заявки для классификации (включая «Снята» на окончании аукциона). */
  classificationBuyOrders?: BuyOrder[];
  trades?: Trade[];
  isMinfin?: boolean;
  isAdmin?: boolean;
}

export function ReportsPanel({
  auction,
  buyOrders,
  classificationBuyOrders,
  trades = [],
  isMinfin = false,
  isAdmin = false,
}: ReportsPanelProps) {
  const auctionCompleted = !isAuctionActive(auction);
  const classificationAvailable = auctionCompleted || isAdmin;
  const availableOptions = useMemo(
    () => getAvailableReportOptions({ isMinfin, isAdmin, auctionCompleted }),
    [isMinfin, isAdmin, auctionCompleted],
  );
  const ordersForClassification = classificationBuyOrders ?? buyOrders;

  const [activeReportId, setActiveReportId] = useState<ReportId>(
    () => availableOptions[0]?.id ?? 'summaryBids',
  );

  useEffect(() => {
    if (availableOptions.some((option) => option.id === activeReportId)) return;
    const fallback = availableOptions[0]?.id;
    if (fallback) setActiveReportId(fallback);
  }, [availableOptions, activeReportId]);

  return (
    <div className={styles.panel}>
      <div className={styles.selector}>
        <label className={styles.selectorLabel} htmlFor="reportType">
          Тип отчета
        </label>
        <select
          id="reportType"
          className={styles.selectorControl}
          value={activeReportId}
          onChange={(event) => setActiveReportId(event.target.value as ReportId)}
        >
          {availableOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className={styles.hint}>
        Отчет формируется только по текущему аукциону{' '}
        {auction.SecCode ? `(${auction.SecCode})` : ''}.
        {!classificationAvailable && (
          <> Классификация заявок станет доступна после завершения аукциона.</>
        )}
      </p>

      {activeReportId === 'orderClassification' && classificationAvailable && (
        <OrderClassificationReport auction={auction} buyOrders={ordersForClassification} />
      )}
      {activeReportId === 'summaryBids' && (
        <SummaryBidsReport auction={auction} buyOrders={buyOrders} />
      )}
      {activeReportId === 'vedomost2' && (
        <Vedomost2Report auction={auction} buyOrders={buyOrders} trades={trades} />
      )}
      {activeReportId === 'centralDepository' && !isMinfin && (
        <CentralDepositoryReport auction={auction} buyOrders={buyOrders} />
      )}
    </div>
  );
}
