import {
  aggregateDemandVolume,
  aggregateTradeStats,
  formatDateDdMmYyyy,
  isAuctionCompleted,
  resolveAnnualCouponRate,
} from "../completedAuctionsService.js";

describe("resolveAnnualCouponRate (Ведомость 1)", () => {
  test("returns null for empty/zero coupon", () => {
    expect(resolveAnnualCouponRate(null, 182)).toBeNull();
    expect(resolveAnnualCouponRate(0, 182)).toBeNull();
    expect(resolveAnnualCouponRate("", 182)).toBeNull();
  });

  test("returns couponvalue when period is missing", () => {
    expect(resolveAnnualCouponRate(5.5, null)).toBe(5.5);
    expect(resolveAnnualCouponRate(5.5, 0)).toBe(5.5);
  });

  test("applies round(365/period) * couponvalue", () => {
    // Math.round(365/182) = 2; 2 * 5 = 10
    expect(resolveAnnualCouponRate(5, 182)).toBe(10);
    // Math.round(365/91) = 4; 4 * 2.5 = 10
    expect(resolveAnnualCouponRate(2.5, 91)).toBe(10);
  });
});

describe("formatDateDdMmYyyy", () => {
  test("formats ISO date", () => {
    expect(formatDateDdMmYyyy("2026-07-17")).toBe("17/07/2026");
  });

  test("formats YYYYMMDD", () => {
    expect(formatDateDdMmYyyy("20260717")).toBe("17/07/2026");
  });
});

describe("isAuctionCompleted", () => {
  test("true when end datetime is in the past", () => {
    const now = new Date("2026-07-17T12:00:00Z");
    expect(isAuctionCompleted("2026-07-16", "15:00:00", now)).toBe(true);
  });

  test("false when end datetime is in the future", () => {
    const now = new Date("2026-07-16T05:00:00Z");
    expect(isAuctionCompleted("2099-01-01", "10:00:00", now)).toBe(false);
  });

  test("uses end of day when endtime is missing", () => {
    const now = new Date("2026-07-17T20:00:00Z");
    expect(isAuctionCompleted("2026-07-16", null, now)).toBe(true);
  });

  test("true when trading status is closed even before endtime", () => {
    const now = new Date("2026-07-17T05:00:00Z");
    expect(
      isAuctionCompleted("2026-07-17", "23:00:00", now, "заморожена", "закрыта"),
    ).toBe(true);
  });
});

describe("aggregateDemandVolume", () => {
  test("sums buy order qty and skips cancelled", () => {
    const volume = aggregateDemandVolume([
      { Operation: "Купля", State: "Активна", Qty: 1000, Value: 90000, Price: 90 },
      { Operation: "Купля", State: "Исполнена", Qty: 500, Value: 45000, Price: 90 },
      { Operation: "Купля", State: "Снята", Qty: 999, Value: 999, Price: 90 },
      { Operation: "Продажа", State: "Активна", Qty: 100, Value: 100, Price: 90 },
    ]);
    expect(volume).toBe(1500);
  });
});

describe("aggregateTradeStats", () => {
  test("dedupes by TradeNum and computes yields", () => {
    const stats = aggregateTradeStats([
      { TradeNum: "1", Price: 90, Qty: 10, Value: 900, Yield: 10 },
      { TradeNum: "1", Price: 90, Qty: 10, Value: 900, Yield: 10 }, // duplicate side
      { TradeNum: "2", Price: 85, Qty: 20, Value: 1700, Yield: 15 },
    ]);
    expect(stats.dealVolume).toBe(30);
    expect(stats.minYield).toBe(10);
    expect(stats.maxYield).toBe(15);
    // (10*10 + 15*20) / 30 = 13.3333...
    expect(stats.avgYield).toBeCloseTo(13.3333, 3);
  });

  test("derives yield from price when Yield is empty", () => {
    const stats = aggregateTradeStats([
      { TradeNum: "1", Price: 92, Qty: 5, Value: 460, Yield: 0 },
    ]);
    expect(stats.minYield).toBe(8);
    expect(stats.maxYield).toBe(8);
    expect(stats.avgYield).toBe(8);
  });
});
