import type { Auction } from '@/types/auction';
import { resolveOrderQuantity, round4 } from '@/utils/allocation';
import { matchesAuctionDate, toAuctionDateParam } from '@/utils/auctionDate';
import { isCancelledOrderState } from '@/utils/orderState';

export interface OrderPriceQtyItem {
  ClassCode?: string;
  SecCode?: string;
  Price?: string;
  Qty?: string;
  Value?: string;
  OrderDateTime?: string;
  Operation?: string;
  State?: string;
}

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Средневзвешенная цена по конкурентным заявкам: Σ(price×qty) / Σ(qty). */
export function computeWeightedAveragePriceFromOrders(
  orders: Array<{ price: number; quantity: number; amount?: number }>,
): number | null {
  let priceSum = 0;
  let qtySum = 0;

  for (const order of orders) {
    if (!(order.price > 0)) continue;
    const qty = resolveOrderQuantity(order.quantity, order.amount ?? 0, order.price);
    if (!(qty > 0)) continue;
    priceSum += order.price * qty;
    qtySum += qty;
  }

  if (!(qtySum > 0)) return null;
  return round4(priceSum / qtySum);
}

function isBuyOrder(order: OrderPriceQtyItem): boolean {
  const operation = (order.Operation ?? '').toLowerCase();
  if (!operation) return true;
  return operation.includes('куп');
}

function matchesAuctionInstrument(
  order: OrderPriceQtyItem,
  auction: Auction,
): boolean {
  const orderSec = (order.SecCode ?? '').trim();
  const auctionSec = (auction.SecCode ?? '').trim();
  if (!orderSec || !auctionSec || orderSec !== auctionSec) return false;

  const auctionClass = (auction.ClassCode ?? '').trim();
  if (!auctionClass) return true;
  return (order.ClassCode ?? '').trim() === auctionClass;
}

/**
 * Подставляет в auction.waprice средневзвешенную цену, посчитанную по заявкам.
 * Если по заявкам посчитать нельзя — оставляет исходное значение.
 */
export function enrichAuctionsWithOrderWaPrice(
  auctions: Auction[],
  orders: OrderPriceQtyItem[],
): Auction[] {
  if (auctions.length === 0) return auctions;

  return auctions.map((auction) => {
    const relevant = orders.filter((order) => {
      if (!matchesAuctionInstrument(order, auction)) return false;
      if (!isBuyOrder(order)) return false;
      if (isCancelledOrderState(order.State)) return false;
      if (!matchesAuctionDate(order.OrderDateTime, auction.TradeDate)) return false;
      return toNumber(order.Price) > 0;
    });

    const normalized = relevant.map((order) => {
      const price = toNumber(order.Price);
      const amount = toNumber(order.Value);
      return {
        price,
        quantity: resolveOrderQuantity(toNumber(order.Qty), amount, price),
        amount,
      };
    });

    const wa = computeWeightedAveragePriceFromOrders(normalized);
    if (wa == null || !(wa > 0)) return auction;

    return {
      ...auction,
      waprice: String(wa),
    };
  });
}

/** Уникальные YYYYMMDD дат аукционов для запроса заявок. */
export function collectAuctionDateParams(auctions: Auction[]): string[] {
  const dates = new Set<string>();
  for (const auction of auctions) {
    const param = toAuctionDateParam(auction.TradeDate);
    if (param) dates.add(param);
  }
  return [...dates];
}
