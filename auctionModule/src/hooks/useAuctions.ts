import { useCallback, useEffect, useState } from 'react';
import { getAuctions } from '@/api/auctions';
import type { Auction } from '@/types/auction';
import { isAuctionActive } from '@/utils/auctionStatus';

interface UseAuctionsResult {
  auctions: Auction[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  refresh: () => void;
}

export function useAuctions(todayOnly: boolean): UseAuctionsResult {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const hasActiveAuction = auctions.some((auction) => isAuctionActive(auction));

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const response = await getAuctions({
        limit: 200,
        offset: 0,
        today: todayOnly,
      });
      setAuctions(response.data ?? []);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setAuctions([]);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [todayOnly]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getAuctions({
          limit: 200,
          offset: 0,
          today: todayOnly,
        });
        if (!cancelled) {
          setAuctions(response.data ?? []);
          setLastUpdatedAt(new Date());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки');
          setAuctions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [todayOnly]);

  useEffect(() => {
    if (!hasActiveAuction) return;

    const timer = window.setInterval(() => {
      void fetchData(false);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasActiveAuction, fetchData]);

  return {
    auctions,
    loading,
    error,
    lastUpdatedAt,
    refresh: () => {
      void fetchData(true);
    },
  };
}
