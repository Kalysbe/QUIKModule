import { useEffect, useMemo, useState } from 'react';
import type { Auction, BuyOrder, PreliminaryCalculation } from '@/types/auction';
import { getLatestPreliminaryCalculation } from '@/api/auctions';
import { formatReportMoney, formatReportPercent, formatShortDate } from '@/utils/format';
import { downloadCsv } from '@/utils/download';
import { buildCentralDepositoryReport } from './buildCentralDepositoryReport';
import styles from './OrderClassificationReport.module.css';

interface CentralDepositoryReportProps {
  auction: Auction;
  buyOrders: BuyOrder[];
}

function formatQty(value: number): string {
  return value.toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  });
}

export function CentralDepositoryReport({
  auction,
  buyOrders,
}: CentralDepositoryReportProps) {
  const [preliminary, setPreliminary] = useState<PreliminaryCalculation | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const auctionId = String(auction.auction_id ?? auction.SecCode ?? '');
    if (!auctionId) {
      setPreliminary(null);
      return;
    }

    void getLatestPreliminaryCalculation(auctionId)
      .then((data) => {
        if (!cancelled) setPreliminary(data);
      })
      .catch(() => {
        if (!cancelled) setPreliminary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [auction]);

  const report = useMemo(
    () =>
      buildCentralDepositoryReport(auction, buyOrders, {
        preliminary,
      }),
    [auction, buyOrders, preliminary],
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const rows = [
      [
        'Наименование дилера',
        'Фактическое количество гцб',
        'Фактическая стоимость (сом)',
        'Цена заявки (сом)',
        'Доходность по цене (в %)',
      ],
      ...report.rows.map((row) => [
        row.dealerName,
        row.actualQuantity,
        row.actualValue,
        row.bidPrice,
        row.yieldPercent,
      ]),
      ['Итого', report.totalActualQuantity, report.totalActualValue, '', ''],
    ];
    const safeCode = (auction.SecCode ?? 'report').replace(/[^\w.-]/g, '_');
    downloadCsv(rows, `${safeCode}_central_depository.csv`);
  };

  return (
    <div className={`${styles.report} report-print-root`}>
      <div className={styles.printArea}>
        <div className={styles.header}>
          <h2 className={styles.title}>Ведомость для Центрального депозитария</h2>
          <div className={styles.reportDate}>
            Дата: {formatShortDate(report.reportDate)}
          </div>
        </div>

        <h3 className={styles.sectionTitle}>Общая информация по аукциону</h3>
        <table className={styles.infoTable}>
          <tbody>
            <tr>
              <td className={styles.infoLabel}>Регистрационный номер</td>
              <td className={styles.infoValue}>{report.registrationNumber}</td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Дата аукциона</td>
              <td className={styles.infoValue}>
                {formatShortDate(report.auctionDate)}
              </td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Объем выпуска (сом)</td>
              <td className={styles.infoValue}>
                {formatReportMoney(report.issueVolume)}
              </td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>в т.ч Неконкурентные на сумму (сом)</td>
              <td className={styles.infoValue}>
                {formatReportMoney(report.nonCompetitiveAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Наименование дилера</th>
              <th>Фактическое количество гцб</th>
              <th>Фактическая стоимость (сом)</th>
              <th>Цена заявки (сом)</th>
              <th>Доходность по цене (в %)</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length > 0 ? (
              report.rows.map((row, index) => (
                <tr key={`${row.orderId}-${index}`}>
                  <td className={styles.dealerCell}>{row.dealerName}</td>
                  <td className={styles.numericCell}>
                    {formatQty(row.actualQuantity)}
                  </td>
                  <td className={styles.numericCell}>
                    {formatReportMoney(row.actualValue)}
                  </td>
                  <td className={styles.numericCell}>
                    {formatReportMoney(row.bidPrice)}
                  </td>
                  <td className={styles.numericCell}>
                    {formatReportPercent(row.yieldPercent)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className={styles.emptyRow}>
                <td colSpan={5}>Нет конкурентных заявок по данному аукциону</td>
              </tr>
            )}
            <tr className={styles.totalRow}>
              <td className={styles.dealerCell}>Итого:</td>
              <td className={styles.numericCell}>
                {formatQty(report.totalActualQuantity)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.totalActualValue)}
              </td>
              <td />
              <td />
            </tr>
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
