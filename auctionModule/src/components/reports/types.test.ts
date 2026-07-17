import { describe, expect, it } from 'vitest';
import { getAvailableReportOptions } from './types';

describe('getAvailableReportOptions', () => {
  it('hides central depository report for minfin', () => {
    const options = getAvailableReportOptions({
      isMinfin: true,
      auctionCompleted: true,
    });

    expect(options.map((o) => o.id)).toEqual([
      'orderClassification',
      'summaryBids',
      'vedomost2',
    ]);
  });

  it('hides order classification until auction is completed for non-admin', () => {
    const options = getAvailableReportOptions({
      isMinfin: false,
      isAdmin: false,
      auctionCompleted: false,
    });

    expect(options.map((o) => o.id)).toEqual([
      'summaryBids',
      'vedomost2',
      'centralDepository',
    ]);
  });

  it('shows order classification for admin before auction completion', () => {
    const options = getAvailableReportOptions({
      isAdmin: true,
      auctionCompleted: false,
    });

    expect(options.map((o) => o.id)).toEqual([
      'orderClassification',
      'summaryBids',
      'vedomost2',
      'centralDepository',
    ]);
  });

  it('shows all reports for operator after auction completion', () => {
    const options = getAvailableReportOptions({
      isMinfin: false,
      auctionCompleted: true,
    });

    expect(options.map((o) => o.id)).toEqual([
      'orderClassification',
      'summaryBids',
      'vedomost2',
      'centralDepository',
    ]);
  });
});
