/** Календарная дата YYYY-MM-DD из строки даты/времени. */
export function toDateKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** YYYYMMDD для query-параметра AuctionDate. */
export function toAuctionDateParam(
  value: string | null | undefined,
): string | undefined {
  const key = toDateKey(value);
  if (!key) return undefined;
  return key.replace(/-/g, '');
}

/** Совпадает ли дата записи с датой аукциона. Без даты аукциона — не фильтруем. */
export function matchesAuctionDate(
  itemDate: string | null | undefined,
  auctionDate: string | null | undefined,
): boolean {
  const auctionKey = toDateKey(auctionDate);
  if (!auctionKey) return true;

  const itemKey = toDateKey(itemDate);
  if (!itemKey) return false;

  return itemKey === auctionKey;
}
