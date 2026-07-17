import type { BuyOrder } from '@/types/auction';
import { getOrderQuantity, getOrderYield, round4 } from '@/utils/allocation';

export interface PriceYieldStats {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  minYield: number;
  maxYield: number;
  avgYield: number;
  demandAmount: number;
  demandQuantity: number;
}

function pickPositive(...values: number[]): number {
  for (const value of values) {
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

/** Считает цену/доходность и объём спроса по заявкам; Params — запасной источник. */
export function computePriceYieldStats(
  orders: BuyOrder[],
  params: {
    bid?: number;
    offer?: number;
    low?: number;
    high?: number;
    waprice?: number;
    last?: number;
    qty?: number;
    value?: number;
  } = {},
): PriceYieldStats {
  const competitive = orders.filter(
    (order) => order.price > 0 && getOrderQuantity(order) > 0,
  );

  let demandQuantity = 0;
  let demandAmount = 0;
  for (const order of orders) {
    demandQuantity += getOrderQuantity(order);
    demandAmount += order.amount > 0 ? order.amount : 0;
  }

  if (competitive.length === 0) {
    const minPrice = pickPositive(params.low, params.bid);
    const maxPrice = pickPositive(params.high, params.offer);
    const avgPrice = pickPositive(params.waprice, params.last, minPrice, maxPrice);
    return {
      minPrice,
      maxPrice,
      avgPrice,
      minYield: minPrice > 0 ? round4(Math.max(0, 100 - minPrice)) : 0,
      maxYield: maxPrice > 0 ? round4(Math.max(0, 100 - maxPrice)) : 0,
      avgYield: avgPrice > 0 ? round4(Math.max(0, 100 - avgPrice)) : 0,
      demandAmount: pickPositive(demandAmount, params.value),
      demandQuantity: pickPositive(demandQuantity, params.qty),
    };
  }

  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;
  let minYield = Number.POSITIVE_INFINITY;
  let maxYield = 0;
  let priceWeight = 0;
  let priceSum = 0;
  let yieldWeight = 0;
  let yieldSum = 0;

  for (const order of competitive) {
    const qty = getOrderQuantity(order);
    const yieldValue = getOrderYield(order);

    if (order.price < minPrice) minPrice = order.price;
    if (order.price > maxPrice) maxPrice = order.price;
    if (yieldValue < minYield) minYield = yieldValue;
    if (yieldValue > maxYield) maxYield = yieldValue;

    priceSum += order.price * qty;
    priceWeight += qty;
    if (yieldValue > 0) {
      yieldSum += yieldValue * qty;
      yieldWeight += qty;
    }
  }

  const avgPriceFromOrders = priceWeight > 0 ? priceSum / priceWeight : 0;
  const avgYieldFromOrders = yieldWeight > 0 ? yieldSum / yieldWeight : 0;

  const minPriceFinal = pickPositive(minPrice, params.low, params.bid);
  const maxPriceFinal = pickPositive(maxPrice, params.high, params.offer);
  // Приоритет — средневзвешенная цена по заявкам, Params.waprice — запасной источник.
  const avgPrice = pickPositive(
    avgPriceFromOrders,
    params.waprice,
    params.last,
    minPriceFinal,
    maxPriceFinal,
  );

  const minYieldFinal =
    Number.isFinite(minYield) && minYield !== Number.POSITIVE_INFINITY
      ? round4(minYield)
      : minPriceFinal > 0
        ? round4(Math.max(0, 100 - minPriceFinal))
        : 0;
  const maxYieldFinal =
    maxYield > 0
      ? round4(maxYield)
      : maxPriceFinal > 0
        ? round4(Math.max(0, 100 - maxPriceFinal))
        : 0;
  const avgYield = pickPositive(
    avgYieldFromOrders,
    avgPrice > 0 ? Math.max(0, 100 - avgPrice) : 0,
  );

  return {
    minPrice: round4(minPriceFinal),
    maxPrice: round4(maxPriceFinal),
    avgPrice: round4(avgPrice),
    minYield: round4(minYieldFinal),
    maxYield: round4(maxYieldFinal),
    avgYield: round4(avgYield),
    demandAmount: pickPositive(demandAmount, params.value),
    demandQuantity: pickPositive(demandQuantity, params.qty),
  };
}
