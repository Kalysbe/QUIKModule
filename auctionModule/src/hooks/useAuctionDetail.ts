import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAuctionById,
  getAuctionByIdCached,
  getOrdersByInstrument,
  getTradesByInstrument,
} from '@/api/auctions';
import type { Auction, BuyOrder, Trade } from '@/types/auction';
import { isAuctionActive } from '@/utils/auctionStatus';
import { resolveOrderQuantity } from '@/utils/allocation';
import {
  isActiveOrderState,
  isCancelledOrderState,
  isReportableOrderState,
} from '@/utils/orderState';
import { isWithdrawnAtAuctionEnd } from '@/utils/orderWithdraw';
import { playNewOrderSound } from '@/utils/notificationSound';

interface UseAuctionDetailResult {
  auction: Auction | null;
  buyOrders: BuyOrder[];
  trades: Trade[];
  newOrderNotice: string | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  lastUpdatedAt: Date | null;
  refresh: () => void;
  clearNewOrderNotice: () => void;
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatOrderDateTime(value: string | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return value;
  }
}

function getOrderYieldFromApi(price: number, yieldValue: number): number {
  if (yieldValue > 0) return yieldValue;
  if (price > 0) return Math.max(0, 100 - price);
  return 0;
}

async function loadBuyOrders(auction: Auction): Promise<BuyOrder[]> {
  if (!auction.ClassCode || !auction.SecCode) return [];
  const orders = await getOrdersByInstrument(
    auction.ClassCode,
    auction.SecCode,
    auction.TradeDate,
  );

  return orders
    .filter((order) => {
      const operation = (order.Operation ?? '').toLowerCase();
      if (!operation.includes('куп')) return false;
      if (!isCancelledOrderState(order.State)) return true;
      // «Снята» — только если снята в момент окончания аукциона (для классификации).
      return isWithdrawnAtAuctionEnd(
        order.State,
        order.WithdrawDateTime,
        auction.TradeDate,
        auction.endtime,
      );
    })
    .map((order) => {
      const price = toNumber(order.Price);
      const yieldValue = toNumber(order.Yield);
      const state = order.State?.trim() || '—';

      const amount = toNumber(order.Value);
      return {
        orderId: order.OrderNum ?? '',
        instrument: order.SecCode ?? auction.SecCode ?? '—',
        price,
        quantity: resolveOrderQuantity(toNumber(order.Qty), amount, price),
        amount,
        desiredYield: getOrderYieldFromApi(price, yieldValue),
        account: order.TradingAccount ?? order.Account ?? '—',
        firmId: order.FirmId?.trim() || '',
        firmName: order.FirmName?.trim() || '',
        dealerName:
          order.ClientName?.trim() ||
          order.Comment?.trim() ||
          order.ClientCode?.trim() ||
          order.TradingAccount?.trim() ||
          order.Account?.trim() ||
          '—',
        submittedAt: formatOrderDateTime(order.OrderDateTime),
        state,
        withdrawDateTime: order.WithdrawDateTime ?? null,
        isActive: isActiveOrderState(order.State),
        // Снятые на окончании — не в общих ведомостях/таблице, только в классификации.
        isReportable: isReportableOrderState(order.State),
      };
    });
}

async function loadTrades(auction: Auction): Promise<Trade[]> {
  if (!auction.ClassCode || !auction.SecCode) return [];
  const trades = await getTradesByInstrument(
    auction.ClassCode,
    auction.SecCode,
    auction.TradeDate,
  );

  return trades.map((trade) => {
    const price = toNumber(trade.Price);
    const yieldValue = toNumber(trade.Yield);
    const amount = toNumber(trade.Value);
    return {
      tradeId: trade.TradeNum != null ? String(trade.TradeNum) : '',
      orderNum: trade.OrderNum != null ? String(trade.OrderNum) : '',
      instrument: trade.SecCode ?? auction.SecCode ?? '—',
      price,
      quantity: resolveOrderQuantity(toNumber(trade.Qty), amount, price),
      amount,
      yieldValue: getOrderYieldFromApi(price, yieldValue),
      account: trade.TradingAccount ?? trade.Account ?? '—',
      firmName: trade.FirmName?.trim() || '',
      dealerName:
        trade.ClientName?.trim() ||
        trade.Comment?.trim() ||
        trade.ClientCode?.trim() ||
        trade.TradingAccount?.trim() ||
        trade.Account?.trim() ||
        '—',
      tradedAt: formatOrderDateTime(trade.TradeDateTime ?? trade.TradeDate),
    };
  });
}

export function useAuctionDetail(
  auctionId: string | undefined,
): UseAuctionDetailResult {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [buyOrders, setBuyOrders] = useState<BuyOrder[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [newOrderNotice, setNewOrderNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(auctionId));
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(!auctionId);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const ordersInitializedRef = useRef(false);

  const handleNewOrders = useCallback((orders: BuyOrder[], currentAuction: Auction) => {
    const orderIds = orders
      .filter((order) => order.isActive)
      .map((order) => order.orderId)
      .filter((id) => id.length > 0);

    if (!ordersInitializedRef.current) {
      knownOrderIdsRef.current = new Set(orderIds);
      ordersInitializedRef.current = true;
      return;
    }

    const newIds = orderIds.filter((id) => !knownOrderIdsRef.current.has(id));
    knownOrderIdsRef.current = new Set(orderIds);

    if (newIds.length === 0) return;

    const message = `Новых заявок: ${newIds.length} по ${currentAuction.SecCode ?? 'инструменту'}`;
    setNewOrderNotice(message);
    playNewOrderSound();
  }, []);

  const fetchData = useCallback(async (showLoader = true) => {
    if (!auctionId) return;

    if (showLoader) setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await getAuctionById(auctionId);
      if (!data) {
        setNotFound(true);
        setAuction(null);
        setBuyOrders([]);
        setTrades([]);
        knownOrderIdsRef.current = new Set();
        ordersInitializedRef.current = false;
      } else {
        setAuction(data);
        const [orders, loadedTrades] = await Promise.all([
          loadBuyOrders(data),
          loadTrades(data),
        ]);
        setBuyOrders(orders);
        setTrades(loadedTrades);
        handleNewOrders(orders, data);
        setLastUpdatedAt(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [auctionId, handleNewOrders]);

  useEffect(() => {
    if (!auctionId) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await getAuctionByIdCached(auctionId);
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          setAuction(null);
          setBuyOrders([]);
          setTrades([]);
          knownOrderIdsRef.current = new Set();
          ordersInitializedRef.current = false;
        } else {
          setAuction(data);
          const [orders, loadedTrades] = await Promise.all([
            loadBuyOrders(data),
            loadTrades(data),
          ]);
          if (cancelled) return;
          setBuyOrders(orders);
          setTrades(loadedTrades);
          handleNewOrders(orders, data);
          setLastUpdatedAt(new Date());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [auctionId, handleNewOrders]);

  useEffect(() => {
    knownOrderIdsRef.current = new Set();
    ordersInitializedRef.current = false;
  }, [auctionId]);

  useEffect(() => {
    if (!auctionId || !isAuctionActive(auction)) return;

    const timer = window.setInterval(() => {
      void fetchData(false);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [auctionId, auction, fetchData]);

  return {
    auction: auctionId ? auction : null,
    buyOrders,
    trades,
    newOrderNotice,
    loading: auctionId ? loading : false,
    error,
    notFound: !auctionId || notFound,
    lastUpdatedAt,
    refresh: () => {
      void fetchData(true);
    },
    clearNewOrderNotice: () => setNewOrderNotice(null),
  };
}
