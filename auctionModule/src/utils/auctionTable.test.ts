import { describe, expect, it } from 'vitest';
import type { Auction } from '@/types/auction';
import { filterAuctions, sortAuctions } from '@/utils/auctionTable';

const auctions: Auction[] = [
  { SecCode: 'GCB001', auction_id: '1', status: 'Активен', tradingstatus: 'Торги' },
  { SecCode: 'GCB002', auction_id: '2', status: 'Закрыт', tradingstatus: 'Ожидание' },
];

describe('sortAuctions', () => {
  it('sorts by trade date descending (newest first)', () => {
    const items: Auction[] = [
      { SecCode: 'A', TradeDate: '2026-06-24' },
      { SecCode: 'B', TradeDate: '2026-06-30' },
      { SecCode: 'C', TradeDate: '2026-06-25' },
    ];

    const sorted = sortAuctions(items, 'TradeDate', 'desc');
    expect(sorted.map((item) => item.SecCode)).toEqual(['B', 'C', 'A']);
  });
});

describe('filterAuctions', () => {
  it('filters by search query', () => {
    expect(filterAuctions(auctions, 'gcb002').map((item) => item.auction_id)).toEqual(['2']);
  });

  it('filters by status and trading status', () => {
    expect(
      filterAuctions(auctions, '', 'Активен', 'Торги').map((item) => item.auction_id),
    ).toEqual(['1']);
  });
});
