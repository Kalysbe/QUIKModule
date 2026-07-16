import { useEffect, useState } from 'react';
import { isAuctionActive } from '@/utils/auctionStatus';
import type { Auction } from '@/types/auction';
import styles from './LiveIndicator.module.css';

interface LiveIndicatorProps {
  active: boolean;
  lastUpdatedAt: Date | null;
  auction?: Auction | null;
}

function formatAgo(seconds: number): string {
  if (seconds < 5) return 'только что';
  if (seconds < 60) return `${seconds} сек назад`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин назад`;
}

export function LiveIndicator({ active, lastUpdatedAt, auction }: LiveIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lastUpdatedAt]);

  if (!active && !lastUpdatedAt) return null;

  const isTrading = auction ? isAuctionActive(auction) : active;
  const secondsAgo = lastUpdatedAt
    ? Math.max(0, Math.floor((now - lastUpdatedAt.getTime()) / 1000))
    : null;

  return (
    <div className={styles.wrap}>
      {isTrading && (
        <span className={styles.live}>
          <span className={styles.dot} aria-hidden />
          Идут торги
        </span>
      )}
      {secondsAgo != null && (
        <span className={styles.updated}>Обновлено {formatAgo(secondsAgo)}</span>
      )}
    </div>
  );
}
