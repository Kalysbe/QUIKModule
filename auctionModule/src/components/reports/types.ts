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
  { id: 'vedomost2', label: 'Ведомость 2' },
  { id: 'centralDepository', label: 'Ведомость для ЦД' },
];
