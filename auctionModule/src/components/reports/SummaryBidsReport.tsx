import { useEffect, useMemo, useState } from 'react';
import { getFirmsDirectory } from '@/api/directories';
import type { Auction, BuyOrder } from '@/types/auction';
import { formatReportMoney, formatReportPercent, formatShortDate } from '@/utils/format';
import { downloadCsv } from '@/utils/download';
import {
  buildSummaryBidsReport,
  formatCirculationYears,
  type FirmStatusLookup,
} from './buildSummaryBidsReport';
import styles from './SummaryBidsReport.module.css';

interface SummaryBidsReportProps {
  auction: Auction;
  buyOrders: BuyOrder[];
}

function formatQty(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SummaryBidsReport({ auction, buyOrders }: SummaryBidsReportProps) {
  const [firmStatuses, setFirmStatuses] = useState<Record<string, FirmStatusLookup>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const firms = await getFirmsDirectory();
        if (cancelled) return;
        const map: Record<string, FirmStatusLookup> = {};
        for (const firm of firms) {
          if (!firm.firm_id) continue;
          map[firm.firm_id] = {
            statusName: firm.status_name,
            resident: firm.resident,
          };
        }
        setFirmStatuses(map);
      } catch {
        if (!cancelled) setFirmStatuses({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const report = useMemo(
    () => buildSummaryBidsReport(auction, buyOrders, firmStatuses),
    [auction, buyOrders, firmStatuses],
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const rows: Array<Array<string | number>> = [
      ['Сводная ведомость'],
      ['Дата аукциона', formatShortDate(report.auctionDate)],
      ['Вид ГЦБ', report.securityKind],
      [
        'Срок обращения ГЦБ',
        formatCirculationYears(report.circulationYears),
      ],
      ['Регистрационный номер', report.registrationNumber],
      ['Количество ГЦБ (в штуках)', report.securitiesQuantity],
      ['Объем предложения', report.offerVolume],
      ['Количество участников / Из них', report.participantCount],
      ['Финансовые институты', report.financialInstitutions],
      [
        'Институциональные инвесторы, в том числе страховые компании',
        report.institutionalInvestors,
      ],
      ['Инвесторы резидент/Нерезидент', `${report.residents}/${report.nonResidents}`],
      [],
      [
        'Основа',
        'Кол-во ГЦБ (в штуках)',
        'По номиналу (в сомах)',
        'По факту (в сомах)',
        '% от общего объема',
      ],
      [
        'На конкурентной основе',
        report.competitive.quantity,
        report.competitive.nominalValue,
        report.competitive.actualValue,
        report.competitive.percentOfTotal,
      ],
      [
        'На неконкурентной основе',
        report.nonCompetitive.quantity,
        report.nonCompetitive.nominalValue,
        report.nonCompetitive.actualValue,
        report.nonCompetitive.percentOfTotal,
      ],
      [
        'Всего',
        report.total.quantity,
        report.total.nominalValue,
        report.total.actualValue,
        report.total.percentOfTotal,
      ],
      [],
      [
        'Цена (сом)',
        'Сумма заявок по номинальной цене (сом)',
        'Объем поступлений (сом)',
        'Доходность (в %)',
        'Доходность по цене (в %)',
      ],
      ...report.rows.map((row) => [
        row.price == null ? '' : row.price,
        row.cumulativeNominalValue,
        row.cumulativeReceipts,
        row.weightedAverageYield == null ? '' : row.weightedAverageYield,
        row.yieldByPrice,
      ]),
    ];
    const safeCode = (auction.SecCode ?? 'report').replace(/[^\w.-]/g, '_');
    downloadCsv(rows, `${safeCode}_summary_bids.csv`);
  };

  return (
    <div className={`${styles.report} report-print-root`}>
      <div className={styles.printArea}>
        <div className={styles.header}>
          <h2 className={styles.title}>Сводная ведомость</h2>
          <div className={styles.reportDate}>{formatShortDate(report.reportDate)}</div>
        </div>

        <h3 className={styles.sectionTitle}>Общая информация по аукциону:</h3>
        <table className={styles.infoTable}>
          <tbody>
            <tr>
              <td className={styles.infoLabel}>Дата аукциона</td>
              <td className={styles.infoValue}>{formatShortDate(report.auctionDate)}</td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Вид ГЦБ</td>
              <td className={styles.infoValue}>{report.securityKind}</td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Срок обращения ГЦБ</td>
              <td className={styles.infoValue}>
                {formatCirculationYears(report.circulationYears)}
              </td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Регистрационный номер</td>
              <td className={styles.infoValue}>{report.registrationNumber}</td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Количество ГЦБ (в штуках)</td>
              <td className={styles.infoValue}>
                {report.securitiesQuantity.toLocaleString('ru-RU')}
              </td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Объем предложения</td>
              <td className={styles.infoValue}>
                {formatReportMoney(report.offerVolume)}
              </td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>Купонная ставка (%)</td>
              <td className={styles.infoValue}>
                {report.couponRate != null
                  ? formatReportPercent(report.couponRate)
                  : ''}
              </td>
            </tr>
            <tr>
              <td className={styles.infoLabel}>
                Количество участников
                <div className={styles.infoNestedLabel}>Из них:</div>
              </td>
              <td className={`${styles.infoValue} ${styles.infoValueBottom}`}>
                {report.participantCount}
              </td>
            </tr>
            <tr>
              <td className={styles.infoSubLabel}>Финансовые институты</td>
              <td className={styles.infoValue}>{report.financialInstitutions}</td>
            </tr>
            <tr>
              <td className={styles.infoSubLabel}>
                Институциональные инвесторы, в том числе страховые компании
              </td>
              <td className={styles.infoValue}>{report.institutionalInvestors}</td>
            </tr>
            <tr>
              <td className={styles.infoSubLabel}>Инвесторы резидент/Нерезидент</td>
              <td className={styles.infoValue}>
                {report.residents}/{report.nonResidents}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className={styles.sectionTitle}>Объем поступивших заявок на аукцион</h3>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th className={styles.cornerCell}>ГЦБ</th>
              <th>Кол-во ГЦБ (в штуках)</th>
              <th>По номиналу (в сомах)</th>
              <th>По факту (в сомах)</th>
              <th>% от общего объема поступивших заявок (в %)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>На конкурентной основе</td>
              <td className={styles.numericCell}>
                {formatQty(report.competitive.quantity)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.competitive.nominalValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.competitive.actualValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportPercent(report.competitive.percentOfTotal)} %
              </td>
            </tr>
            <tr>
              <td>На неконкурентной основе</td>
              <td className={styles.numericCell}>
                {formatQty(report.nonCompetitive.quantity)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.nonCompetitive.nominalValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.nonCompetitive.actualValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportPercent(report.nonCompetitive.percentOfTotal)} %
              </td>
            </tr>
            <tr className={styles.totalRow}>
              <td>Всего:</td>
              <td className={styles.numericCell}>{formatQty(report.total.quantity)}</td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.total.nominalValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportMoney(report.total.actualValue)}
              </td>
              <td className={styles.numericCell}>
                {formatReportPercent(report.total.percentOfTotal)} %
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className={`${styles.sectionTitle} ${styles.sectionTitleSpaced}`}>
          Сводная ведомость поступивших заявок:
        </h3>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Цена (сом)</th>
              <th>Сумма заявок по номинальной цене (сом)</th>
              <th>Объем поступлений при удовлетворении заявок по данной цене (сом)</th>
              <th>Доходность (в %)</th>
              <th>Доходность по цене (в %)</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length > 0 ? (
              report.rows.map((row, index) => (
                <tr key={`${row.orderId}-${index}`}>
                  <td className={styles.numericCell}>
                    {row.price == null ? '' : formatReportMoney(row.price)}
                  </td>
                  <td className={styles.numericCell}>
                    {formatReportMoney(row.cumulativeNominalValue)}
                  </td>
                  <td className={styles.numericCell}>
                    {formatReportMoney(row.cumulativeReceipts)}
                  </td>
                  <td className={styles.numericCell}>
                    {row.weightedAverageYield == null
                      ? ''
                      : formatReportPercent(row.weightedAverageYield)}
                  </td>
                  <td className={styles.numericCell}>
                    {formatReportPercent(row.yieldByPrice)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className={styles.emptyRow}>
                <td colSpan={5}>Нет заявок по данному аукциону</td>
              </tr>
            )}
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
