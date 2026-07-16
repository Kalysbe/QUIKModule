import { Link } from 'react-router-dom';
import { prefetchAuctionById } from '@/api/auctions';
import { Badge } from '@/components/ui/Badge';
import type { Auction, AuctionSortKey, SortDirection } from '@/types/auction';
import { formatDate, formatPrice, formatTime } from '@/utils/format';
import { prefetchDetailPage } from '@/router/prefetch';
import styles from './AuctionTable.module.css';

const COLUMNS: { key: AuctionSortKey; label: string }[] = [
  { key: 'SecCode', label: 'Инструмент' },
  { key: 'TradeDate', label: 'Дата аукциона' },
  { key: 'status', label: 'Статус' },
  { key: 'tradingstatus', label: 'Торговый статус' },
  { key: 'waprice', label: 'Средневзв. цена' },
  { key: 'starttime', label: 'Начало' },
  { key: 'endtime', label: 'Окончание' },
];

interface AuctionTableProps {
  auctions: Auction[];
  sortKey: AuctionSortKey;
  sortDir: SortDirection;
  onSort: (key: AuctionSortKey) => void;
  reportsOnly?: boolean;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
  if (!active) return <span className={styles.sortIcon}>↕</span>;
  return <span className={styles.sortIcon}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function handleRowHover(auctionId: string | undefined) {
  if (!auctionId) return;
  prefetchDetailPage();
  prefetchAuctionById(auctionId);
}

export function AuctionTable({
  auctions,
  sortKey,
  sortDir,
  onSort,
  reportsOnly = false,
}: AuctionTableProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.th} ${sortKey === col.key ? styles.thSorted : ''}`}
                  onClick={() => onSort(col.key)}
                  scope="col"
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auctions.map((auction) => {
              const id = auction.auction_id ?? '';
              const detailPath = reportsOnly ? `/auction/${id}?tab=reports` : `/auction/${id}`;
              return (
                <tr
                  key={id || auction.SecCode}
                  className={styles.tr}
                  onMouseEnter={() => handleRowHover(id)}
                >
                  <td className={styles.td}>
                    <Link
                      to={detailPath}
                      className={styles.link}
                      onFocus={() => handleRowHover(id)}
                    >
                      {auction.SecCode ?? '—'}
                    </Link>
                    {id && <span className={styles.id}>#{id}</span>}
                  </td>
                  <td className={styles.td}>
                    {formatDate(auction.TradeDate)}
                  </td>
                  <td className={styles.td}>
                    <Badge label={auction.status ?? '—'} />
                  </td>
                  <td className={styles.td}>
                    <Badge label={auction.tradingstatus ?? '—'} />
                  </td>
                  <td className={`${styles.td} ${styles.mono}`}>
                    {formatPrice(auction.waprice)}
                  </td>
                  <td className={`${styles.td} ${styles.mono}`}>
                    {formatTime(auction.starttime)}
                  </td>
                  <td className={`${styles.td} ${styles.mono}`}>
                    {formatTime(auction.endtime)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
