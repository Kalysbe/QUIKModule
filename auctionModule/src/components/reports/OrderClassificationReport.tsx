import { useMemo } from 'react';
import type { Auction, BuyOrder } from '@/types/auction';
import { formatReportMoney, formatReportPercent, formatShortDate } from '@/utils/format';
import { downloadCsv } from '@/utils/download';
import { buildOrderClassificationReport } from './buildOrderClassificationReport';
import styles from './OrderClassificationReport.module.css';

interface OrderClassificationReportProps {
  auction: Auction;
  buyOrders: BuyOrder[];
}

export function OrderClassificationReport({
  auction,
  buyOrders,
}: OrderClassificationReportProps) {
  const report = useMemo(
    () => buildOrderClassificationReport(auction, buyOrders),
    [auction, buyOrders],
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const rows = [
      ['Наименование дилера', 'Номинальная стоимость (сом)', 'Цена заявки (сом)', 'Доходность (%)'],
      ...report.rows.map((row) => [
        row.dealerName,
        row.nominalValue,
        row.bidPrice,
        row.yieldPercent,
      ]),
      ['Итого', report.totalNominalValue, '', ''],
    ];
    const safeCode = (auction.SecCode ?? 'report').replace(/[^\w.-]/g, '_');
    downloadCsv(rows, `${safeCode}_classification.csv`);
  };

  return (
    <div className={`${styles.report} report-print-root`}>
      <div className={styles.printArea}>
        <div className={styles.header}>
          <h2 className={styles.title}>КЛАССИФИКАЦИЯ ЗАЯВОК</h2>
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
              <td className={styles.infoValue}>{formatShortDate(report.auctionDate)}</td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Объем выпуска (сом)</td>
              <td className={styles.infoValue}>{formatReportMoney(report.issueVolume)}</td>
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
              <th>Номинальная стоимость (сом)</th>
              <th>Цена заявки (сом)</th>
              <th>Доходность по цене (в %)</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length > 0 ? (
              report.rows.map((row, index) => (
                <tr key={`${row.dealerName}-${row.bidPrice}-${index}`}>
                  <td className={styles.dealerCell}>{row.dealerName}</td>
                  <td className={styles.numericCell}>
                    {formatReportMoney(row.nominalValue)}
                  </td>
                  <td className={styles.numericCell}>{formatReportMoney(row.bidPrice)}</td>
                  <td className={styles.numericCell}>
                    {formatReportPercent(row.yieldPercent)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className={styles.emptyRow}>
                <td colSpan={4}>Нет конкурентных заявок по данному аукциону</td>
              </tr>
            )}
            <tr className={styles.totalRow}>
              <td className={styles.dealerCell}>Итого:</td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.totalNominalValue)}
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
