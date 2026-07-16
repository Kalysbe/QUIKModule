import type { Auction } from '@/types/auction';

const ACTIVE_MARKERS = ['актив', 'торг', 'идет', 'open', 'active', 'trading'];
const INACTIVE_MARKERS = ['закрыт', 'closed', 'заморож', 'frozen', 'останов'];

function hasMarker(value: string, markers: string[]): boolean {
  const normalized = value.toLowerCase();
  return markers.some((marker) => normalized.includes(marker));
}

export function isAuctionActive(auction: Auction | null | undefined): boolean {
  if (!auction) return false;
  const status = auction.status ?? '';
  const tradingStatus = auction.tradingstatus ?? '';
  const text = `${status} ${tradingStatus}`.trim();
  if (!text) return false;

  if (hasMarker(text, INACTIVE_MARKERS)) return false;
  return hasMarker(text, ACTIVE_MARKERS);
}
