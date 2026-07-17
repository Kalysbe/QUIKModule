export type ReportId =
  | 'orderClassification'
  | 'summaryBids'
  | 'vedomost2'
  | 'centralDepository';

export interface ReportOption {
  id: ReportId;
  label: string;
}

export const REPORT_OPTIONS: ReportOption[] = [
  { id: 'orderClassification', label: 'Классификация заявок' },
  { id: 'summaryBids', label: 'Сводная ведомость' },
  { id: 'vedomost2', label: 'Сводная ведомость 2' },
  { id: 'centralDepository', label: 'Ведомость для ЦД' },
];

export interface GetAvailableReportOptionsParams {
  /** Минфин не видит ведомость для ЦД */
  isMinfin?: boolean;
  /** Админ видит классификацию заявок до завершения аукциона */
  isAdmin?: boolean;
  /** Классификация заявок — только после завершения аукциона (кроме admin) */
  auctionCompleted?: boolean;
}

export function getAvailableReportOptions({
  isMinfin = false,
  isAdmin = false,
  auctionCompleted = false,
}: GetAvailableReportOptionsParams = {}): ReportOption[] {
  return REPORT_OPTIONS.filter((option) => {
    if (option.id === 'centralDepository' && isMinfin) return false;
    if (
      option.id === 'orderClassification' &&
      !auctionCompleted &&
      !isAdmin
    ) {
      return false;
    }
    return true;
  });
}
