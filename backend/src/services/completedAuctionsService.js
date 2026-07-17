/**
 * Агрегация данных по завершённым аукционам для публичного API.
 * Купонная ставка — как в «Сводной ведомости» (Ведомость 1):
 * round2(Math.round(365 / couponperiod) * couponvalue).
 */
import pgPool from "../config/dbPostgres.js";
import pgKsePool from "../config/dbKse.js";

// KSE — Бишкек (UTC+6). Asia/Almaty с 2024 = UTC+5, для КР не подходит.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Bishkek";
const PARAMS_TABLE = "Params";
const ORDERS_TABLE = "Orders";
const TRADES_TABLE = "Trades";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function toNumber(value) {
  if (value == null || value === "") return 0;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

/** Годовая купонная ставка (логика Ведомости 1). */
export function resolveAnnualCouponRate(couponValue, couponPeriod) {
  const rate = toNumber(couponValue);
  if (rate <= 0) return null;

  const period = toNumber(couponPeriod);
  if (period <= 0) return round2(rate);

  return round2(Math.round(365 / period) * rate);
}

/** YYYY-MM-DD → dd/mm/yyyy */
export function formatDateDdMmYyyy(value) {
  const s = String(value ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
  }
  return s || null;
}

function normalizeIsoDate(value) {
  const s = String(value ?? "").trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function normalizeTimeOfDay(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hh = String(value.getUTCHours()).padStart(2, "0");
    const mm = String(value.getUTCMinutes()).padStart(2, "0");
    const ss = String(value.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  const s = String(value).trim();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hh = String(Number(timeMatch[1])).padStart(2, "0");
    const mm = timeMatch[2];
    const ss = timeMatch[3] ?? "00";
    return `${hh}:${mm}:${ss}`;
  }
  return null;
}

/** Текущие дата/время в APP_TIMEZONE как `YYYY-MM-DD HH:MM:SS` (для лексикографического сравнения). */
export function formatNowInAppTimezone(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

const COMPLETED_STATUS_MARKERS = ["закрыт", "заморож", "closed", "frozen"];

/** Статус/торговый статус указывает на завершение (как в UI: закрыта / заморожена). */
export function hasCompletedStatus(status, tradingStatus) {
  const text = `${status ?? ""} ${tradingStatus ?? ""}`.toLowerCase();
  return COMPLETED_STATUS_MARKERS.some((marker) => text.includes(marker));
}

/**
 * Аукцион завершён, если:
 * 1) дата + время окончания уже прошли (≤ now в APP_TIMEZONE), или
 * 2) статус/торговый статус = закрыта/заморожена.
 * Если endtime нет — считаем окончанием 23:59:59.
 */
export function isAuctionCompleted(
  tradeDate,
  endtime,
  now = new Date(),
  status = null,
  tradingStatus = null,
) {
  if (hasCompletedStatus(status, tradingStatus)) return true;

  const dateIso = normalizeIsoDate(tradeDate);
  if (!dateIso) return false;
  const time = normalizeTimeOfDay(endtime) ?? "23:59:59";
  const auctionEnd = `${dateIso} ${time}`;
  return auctionEnd <= formatNowInAppTimezone(now);
}

function resolveColumn(columnNames, candidates) {
  for (const cand of candidates) {
    if (columnNames.has(cand)) return cand;
  }
  const lowerMap = new Map([...columnNames].map((c) => [c.toLowerCase(), c]));
  for (const cand of candidates) {
    const found = lowerMap.get(cand.toLowerCase());
    if (found) return found;
  }
  return null;
}

async function getTableColumnsMeta(tableName) {
  const result = await pgPool.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
    `,
    [tableName],
  );
  const columnNames = new Set(result.rows.map((r) => r.column_name));
  const columnTypes = new Map(
    result.rows.map((r) => [r.column_name, r.data_type]),
  );
  return { columnNames, columnTypes };
}

async function getTableColumns(tableName) {
  const { columnNames } = await getTableColumnsMeta(tableName);
  return columnNames;
}

async function getAuctionClassCodes() {
  const result = await pgKsePool.query(
    `
    SELECT DISTINCT class_code
    FROM public.quik_class_registry
    WHERE trade_segment_id = 1
      AND class_code IS NOT NULL
      AND class_code <> ''
    `,
  );
  return [
    ...new Set(
      result.rows
        .map((r) => String(r.class_code ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

function isCancelledOrderState(state) {
  const normalized = String(state ?? "").toLowerCase();
  return (
    normalized.includes("снят") ||
    normalized.includes("отмен") ||
    normalized.includes("cancel") ||
    normalized.includes("reject")
  );
}

function isBuyOperation(operation) {
  return String(operation ?? "").toLowerCase().includes("куп");
}

function resolveTradeYield(price, yieldValue) {
  const y = toNumber(yieldValue);
  if (y > 0) return round4(y);
  const p = toNumber(price);
  if (p > 0) return round4(Math.max(0, 100 - p));
  return 0;
}

function resolveQuantity(qty, amount, price) {
  const q = toNumber(qty);
  if (q > 0) return q;
  const a = toNumber(amount);
  if (!(a > 0)) return 0;
  const p = toNumber(price);
  if (p > 0) return a / p;
  return a / 100;
}

function auctionKey(classCode, secCode, tradeDate) {
  return `${classCode ?? ""}|${secCode ?? ""}|${tradeDate ?? ""}`;
}

/**
 * Спрос по заявкам: сумма Qty покупок без снятых/отменённых.
 */
export function aggregateDemandVolume(orders) {
  let sum = 0;
  for (const order of orders) {
    if (!isBuyOperation(order.Operation)) continue;
    if (isCancelledOrderState(order.State)) continue;
    sum += resolveQuantity(order.Qty, order.Value, order.Price);
  }
  return round2(sum);
}

/**
 * Объём и доходности по сделкам (TradeNum учитывается один раз).
 * Объём сделки — сумма Qty.
 */
export function aggregateTradeStats(trades) {
  const seen = new Set();
  let dealVolume = 0;
  let minYield = Number.POSITIVE_INFINITY;
  let maxYield = 0;
  let yieldSum = 0;
  let yieldWeight = 0;

  for (const trade of trades) {
    const tradeId =
      trade.TradeNum != null && String(trade.TradeNum).trim() !== ""
        ? String(trade.TradeNum)
        : null;
    if (tradeId) {
      if (seen.has(tradeId)) continue;
      seen.add(tradeId);
    }

    const qty = resolveQuantity(trade.Qty, trade.Value, trade.Price);
    dealVolume += qty;

    const y = resolveTradeYield(trade.Price, trade.Yield);
    if (y > 0) {
      if (y < minYield) minYield = y;
      if (y > maxYield) maxYield = y;
      if (qty > 0) {
        yieldSum += y * qty;
        yieldWeight += qty;
      }
    }
  }

  return {
    dealVolume: round2(dealVolume),
    minYield:
      Number.isFinite(minYield) && minYield !== Number.POSITIVE_INFINITY
        ? round4(minYield)
        : null,
    maxYield: maxYield > 0 ? round4(maxYield) : null,
    avgYield: yieldWeight > 0 ? round4(yieldSum / yieldWeight) : null,
  };
}

async function loadCompletedAuctionRows() {
  const { columnNames: names, columnTypes } = await getTableColumnsMeta(PARAMS_TABLE);
  if (names.size === 0) {
    const err = new Error(`Таблица "${PARAMS_TABLE}" не найдена`);
    err.statusCode = 404;
    throw err;
  }

  const classCodeCol = resolveColumn(names, ["ClassCode", "classcode", "class_code"]);
  const secCodeCol = resolveColumn(names, ["SecCode", "seccode", "sec_code"]);
  const tradeDateCol = resolveColumn(names, ["TradeDate", "tradedate", "trade_date"]);
  const endTimeCol = resolveColumn(names, ["endtime", "EndTime", "end_time"]);
  const auctionIdCol = resolveColumn(names, ["auction_id", "auctionid", "AuctionId"]);
  const issueSizeCol = resolveColumn(names, ["issuesize", "IssueSize", "issue_size"]);
  const couponValueCol = resolveColumn(names, ["couponvalue", "CouponValue", "coupon_value"]);
  const couponPeriodCol = resolveColumn(names, [
    "couponperiod",
    "CouponPeriod",
    "coupon_period",
  ]);
  const statusCol = resolveColumn(names, ["status", "Status"]);
  const tradingStatusCol = resolveColumn(names, [
    "tradingstatus",
    "TradingStatus",
    "trading_status",
  ]);

  if (!classCodeCol || !secCodeCol || !tradeDateCol || !auctionIdCol) {
    const err = new Error(
      `В таблице "${PARAMS_TABLE}" не найдены обязательные столбцы ClassCode/SecCode/TradeDate/auction_id`,
    );
    err.statusCode = 404;
    throw err;
  }

  const auctionClasses = await getAuctionClassCodes();
  if (!auctionClasses.length) return [];

  const tradeDateType = String(columnTypes.get(tradeDateCol) ?? "").toLowerCase();
  let tradeDateExpr;
  if (tradeDateType.includes("date") && !tradeDateType.includes("time")) {
    tradeDateExpr = `to_char(p."${tradeDateCol}"::date, 'YYYY-MM-DD')`;
  } else if (tradeDateType.includes("timestamp with time zone")) {
    tradeDateExpr = `to_char((p."${tradeDateCol}" AT TIME ZONE '${APP_TIMEZONE}')::date, 'YYYY-MM-DD')`;
  } else {
    // timestamp without time zone — «стеновая» дата без сдвига зоны
    tradeDateExpr = `to_char((p."${tradeDateCol}")::date, 'YYYY-MM-DD')`;
  }

  const selectParts = [
    `p."${classCodeCol}" AS "ClassCode"`,
    `p."${secCodeCol}" AS "SecCode"`,
    `${tradeDateExpr} AS "TradeDate"`,
  ];
  if (endTimeCol) {
    selectParts.push(`to_char(p."${endTimeCol}"::time, 'HH24:MI:SS') AS "endtime"`);
  } else {
    selectParts.push(`NULL::text AS "endtime"`);
  }
  if (issueSizeCol) selectParts.push(`p."${issueSizeCol}" AS "issuesize"`);
  else selectParts.push(`NULL AS "issuesize"`);
  if (couponValueCol) selectParts.push(`p."${couponValueCol}" AS "couponvalue"`);
  else selectParts.push(`NULL AS "couponvalue"`);
  if (couponPeriodCol) selectParts.push(`p."${couponPeriodCol}" AS "couponperiod"`);
  else selectParts.push(`NULL AS "couponperiod"`);
  if (statusCol) selectParts.push(`p."${statusCol}" AS "status"`);
  else selectParts.push(`NULL::text AS "status"`);
  if (tradingStatusCol) {
    selectParts.push(`p."${tradingStatusCol}" AS "tradingstatus"`);
  } else {
    selectParts.push(`NULL::text AS "tradingstatus"`);
  }
  selectParts.push(`p."${auctionIdCol}" AS "auction_id"`);

  const result = await pgPool.query(
    `
    SELECT ${selectParts.join(", ")}
    FROM public."${PARAMS_TABLE}" p
    WHERE p."${auctionIdCol}" IS NOT NULL
      AND p."${classCodeCol}"::text = ANY($1::text[])
    ORDER BY p."${tradeDateCol}" DESC NULLS LAST
    `,
    [auctionClasses],
  );

  const now = new Date();
  return result.rows.filter((row) =>
    isAuctionCompleted(
      row.TradeDate,
      row.endtime,
      now,
      row.status,
      row.tradingstatus,
    ),
  );
}

async function loadOrdersForKeys(keys) {
  if (!keys.length) return new Map();

  const names = await getTableColumns(ORDERS_TABLE);
  if (names.size === 0) return new Map();

  const col = {
    ClassCode: resolveColumn(names, ["ClassCode", "classcode", "class_code"]),
    SecCode: resolveColumn(names, ["SecCode", "seccode", "sec_code"]),
    Qty: resolveColumn(names, ["Qty", "qty", "Quantity", "quantity"]),
    Price: resolveColumn(names, ["Price", "price"]),
    Value: resolveColumn(names, ["Value", "value", "Amount", "amount"]),
    Operation: resolveColumn(names, ["Operation", "operation"]),
    State: resolveColumn(names, ["State", "state", "Status", "status"]),
    OrderDateTime: resolveColumn(names, [
      "OrderDateTime",
      "orderdatetime",
      "order_date_time",
      "OrderDate",
      "orderdate",
    ]),
  };

  if (!col.SecCode || !col.OrderDateTime) return new Map();

  const secCodes = [...new Set(keys.map((k) => k.secCode).filter(Boolean))];
  const dates = [...new Set(keys.map((k) => k.tradeDate).filter(Boolean))];

  const selectParts = [
    col.ClassCode ? `"${col.ClassCode}" AS "ClassCode"` : `'' AS "ClassCode"`,
    `"${col.SecCode}" AS "SecCode"`,
    col.Qty ? `"${col.Qty}" AS "Qty"` : `0 AS "Qty"`,
    col.Price ? `"${col.Price}" AS "Price"` : `0 AS "Price"`,
    col.Value ? `"${col.Value}" AS "Value"` : `0 AS "Value"`,
    col.Operation ? `"${col.Operation}" AS "Operation"` : `'' AS "Operation"`,
    col.State ? `"${col.State}" AS "State"` : `'' AS "State"`,
    `to_char("${col.OrderDateTime}"::date, 'YYYY-MM-DD') AS "TradeDate"`,
  ];

  const result = await pgPool.query(
    `
    SELECT ${selectParts.join(", ")}
    FROM public."${ORDERS_TABLE}"
    WHERE "${col.SecCode}"::text = ANY($1::text[])
      AND "${col.OrderDateTime}"::date = ANY($2::date[])
    `,
    [secCodes, dates],
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = auctionKey(row.ClassCode, row.SecCode, row.TradeDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function loadTradesForKeys(keys) {
  if (!keys.length) return new Map();

  const names = await getTableColumns(TRADES_TABLE);
  if (names.size === 0) return new Map();

  const col = {
    TradeNum: resolveColumn(names, ["TradeNum", "tradenum", "trade_num"]),
    ClassCode: resolveColumn(names, ["ClassCode", "classcode", "class_code"]),
    SecCode: resolveColumn(names, ["SecCode", "seccode", "sec_code"]),
    Price: resolveColumn(names, ["Price", "price"]),
    Qty: resolveColumn(names, ["Qty", "qty", "Quantity", "quantity"]),
    Value: resolveColumn(names, ["Value", "value", "Amount", "amount"]),
    Yield: resolveColumn(names, ["Yield", "yield", "DesiredYield", "desired_yield"]),
    TradeDateTime: resolveColumn(names, [
      "TradeDateTime",
      "tradedatetime",
      "trade_date_time",
      "TradeDate",
      "tradedate",
    ]),
  };

  if (!col.SecCode || !col.TradeDateTime) return new Map();

  const secCodes = [...new Set(keys.map((k) => k.secCode).filter(Boolean))];
  const dates = [...new Set(keys.map((k) => k.tradeDate).filter(Boolean))];

  const selectParts = [
    col.TradeNum ? `"${col.TradeNum}" AS "TradeNum"` : `NULL AS "TradeNum"`,
    col.ClassCode ? `"${col.ClassCode}" AS "ClassCode"` : `'' AS "ClassCode"`,
    `"${col.SecCode}" AS "SecCode"`,
    col.Price ? `"${col.Price}" AS "Price"` : `0 AS "Price"`,
    col.Qty ? `"${col.Qty}" AS "Qty"` : `0 AS "Qty"`,
    col.Value ? `"${col.Value}" AS "Value"` : `0 AS "Value"`,
    col.Yield ? `"${col.Yield}" AS "Yield"` : `0 AS "Yield"`,
    `to_char("${col.TradeDateTime}"::date, 'YYYY-MM-DD') AS "TradeDate"`,
  ];

  const result = await pgPool.query(
    `
    SELECT ${selectParts.join(", ")}
    FROM public."${TRADES_TABLE}"
    WHERE "${col.SecCode}"::text = ANY($1::text[])
      AND "${col.TradeDateTime}"::date = ANY($2::date[])
    `,
    [secCodes, dates],
  );

  const map = new Map();
  for (const row of result.rows) {
    const key = auctionKey(row.ClassCode, row.SecCode, row.TradeDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

/**
 * @param {{ limit?: number, offset?: number }} options
 */
export async function getCompletedAuctions(options = {}) {
  let limit = DEFAULT_LIMIT;
  let offset = 0;

  if (options.limit != null) {
    const parsed = Number(options.limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      const err = new Error("Параметр limit должен быть целым числом >= 1");
      err.statusCode = 400;
      throw err;
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  if (options.offset != null) {
    const parsed = Number(options.offset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      const err = new Error("Параметр offset должен быть целым числом >= 0");
      err.statusCode = 400;
      throw err;
    }
    offset = parsed;
  }

  const completed = await loadCompletedAuctionRows();
  const page = completed.slice(offset, offset + limit);

  const keys = page.map((row) => ({
    classCode: String(row.ClassCode ?? "").trim(),
    secCode: String(row.SecCode ?? "").trim(),
    tradeDate: String(row.TradeDate ?? "").trim(),
  }));

  const [ordersMap, tradesMap] = await Promise.all([
    loadOrdersForKeys(keys),
    loadTradesForKeys(keys),
  ]);

  const data = page.map((row) => {
    const key = auctionKey(row.ClassCode, row.SecCode, row.TradeDate);
    const secDateKey = auctionKey("", row.SecCode, row.TradeDate);
    const orders =
      ordersMap.get(key) ??
      ordersMap.get(secDateKey) ??
      [...ordersMap.entries()]
        .filter(([k]) => k.endsWith(`|${row.SecCode}|${row.TradeDate}`))
        .flatMap(([, rows]) => rows);
    const trades =
      tradesMap.get(key) ??
      tradesMap.get(secDateKey) ??
      [...tradesMap.entries()]
        .filter(([k]) => k.endsWith(`|${row.SecCode}|${row.TradeDate}`))
        .flatMap(([, rows]) => rows);
    const tradeStats = aggregateTradeStats(trades);

    return {
      date: formatDateDdMmYyyy(row.TradeDate),
      secCode: row.SecCode ?? null,
      issueVolume: toNumber(row.issuesize),
      demandVolume: aggregateDemandVolume(orders),
      dealVolume: tradeStats.dealVolume,
      minYield: tradeStats.minYield,
      maxYield: tradeStats.maxYield,
      avgYield: tradeStats.avgYield,
      couponRate: resolveAnnualCouponRate(row.couponvalue, row.couponperiod),
    };
  });

  return {
    data,
    pagination: {
      limit,
      offset,
      count: data.length,
      total: completed.length,
    },
  };
}
