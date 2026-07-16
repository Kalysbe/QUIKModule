import { useState } from 'react';
import type { Auction, BuyOrder, Trade } from '@/types/auction';
import { CentralDepositoryReport } from './CentralDepositoryReport';
import { OrderClassificationReport } from './OrderClassificationReport';
import { SummaryBidsReport } from './SummaryBidsReport';
import { Vedomost2Report } from './Vedomost2Report';
import { REPORT_OPTIONS, type ReportId } from './types';
import styles from './ReportsPanel.module.css';

interface ReportsPanelProps {
  auction: Auction;
  buyOrders: BuyOrder[];
  trades?: Trade[];
}

export function ReportsPanel({ auction, buyOrders, trades = [] }: ReportsPanelProps) {
  const [activeReportId, setActiveReportId] = useState<ReportId>('orderClassification');

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
          {REPORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className={styles.hint}>
        Отчет формируется только по текущему аукциону{' '}
        {auction.SecCode ? `(${auction.SecCode})` : ''}.
      </p>

      {activeReportId === 'orderClassification' && (
        <OrderClassificationReport auction={auction} buyOrders={buyOrders} />
      )}
      {activeReportId === 'summaryBids' && (
        <SummaryBidsReport auction={auction} buyOrders={buyOrders} />
      )}
      {activeReportId === 'vedomost2' && (
        <Vedomost2Report auction={auction} buyOrders={buyOrders} trades={trades} />
      )}
      {activeReportId === 'centralDepository' && (
        <CentralDepositoryReport auction={auction} buyOrders={buyOrders} />
      )}
    </div>
  );
}
