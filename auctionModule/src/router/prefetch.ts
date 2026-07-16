let detailPagePrefetched = false;

export function prefetchDetailPage(): void {
  if (detailPagePrefetched) return;
  detailPagePrefetched = true;
  void import('@/pages/AuctionDetailPage');
}
