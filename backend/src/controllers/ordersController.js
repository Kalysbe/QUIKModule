// src/controllers/ordersController.js
import pgPool from "../config/dbPostgres.js";
import { formatYyyymmdd } from "../services/auctionOrdersQuery.js";

/** Кандидаты имён колонок для маппинга (в порядке приоритета) */
const COLUMN_CANDIDATES = {
  OrderNum: ["OrderNum", "ordernum", "order_num"],
  ClassCode: ["ClassCode", "classcode", "class_code"],
  SecCode: ["SecCode", "seccode", "sec_code"],
  Price: ["Price", "price"],
  Qty: ["Qty", "qty", "Quantity", "quantity"],
  Value: ["Value", "value", "Amount", "amount"],
  Yield: ["Yield", "yield", "DesiredYield", "desired_yield"],
  OrderDateTime: ["OrderDateTime", "orderdatetime", "order_date_time", "OrderDate", "orderdate", "order_date"],
  Operation: ["Operation", "operation"],
  State: ["State", "state", "Status", "status"],
  ClientCode: ["ClientCode", "clientcode", "client_code", "BrokerClientCode", "brokerclientcode", "broker_client_code"],
  Account: ["Account", "account", "TradeAccount", "tradeaccount", "TradeAcc", "tradeacc", "TrdAcc", "trdacc"],
  FirmName: ["FirmName", "firmname", "firm_name"],
  FirmId: ["FirmId", "firmid", "firm_id"],
};

/** Находит первую существующую колонку из кандидатов (с учётом регистра) */
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

/** Список колонок для SELECT и фильтрации */
const OUTPUT_COLUMNS = [
  "OrderNum",
  "ClassCode",
  "SecCode",
  "Price",
  "Qty",
  "Value",
  "Yield",
  "OrderDateTime",
  "Operation",
  "State",
  "ClientCode",
  "Account",
  "FirmName",
  "FirmId",
];
const ACTIVE_STATE = "Активна";
const TRADE_TABLE_NAME = "Trades";

const TRADE_COLUMN_CANDIDATES = {
  TradeNum: ["TradeNum", "tradenum", "trade_num"],
  OrderNum: ["OrderNum", "ordernum", "order_num"],
  ClassCode: ["ClassCode", "classcode", "class_code"],
  SecCode: ["SecCode", "seccode", "sec_code"],
  Price: ["Price", "price"],
  Qty: ["Qty", "qty", "Quantity", "quantity"],
  Value: ["Value", "value", "Amount", "amount"],
  Yield: ["Yield", "yield", "DesiredYield", "desired_yield"],
  TradeDateTime: [
    "TradeDateTime",
    "tradedatetime",
    "trade_date_time",
    "TradeDate",
    "tradedate",
    "trade_date",
  ],
  ClientCode: [
    "ClientCode",
    "clientcode",
    "client_code",
    "BrokerClientCode",
    "brokerclientcode",
    "broker_client_code",
  ],
  Account: ["Account", "account", "TradeAccount", "tradeaccount", "TradeAcc", "tradeacc"],
  FirmName: ["FirmName", "firmname", "firm_name"],
};

const TRADE_OUTPUT_COLUMNS = [
  "TradeNum",
  "OrderNum",
  "ClassCode",
  "SecCode",
  "Price",
  "Qty",
  "Value",
  "Yield",
  "TradeDateTime",
  "ClientCode",
  "Account",
  "FirmName",
];

async function queryOrders({ req, onlyActive }) {
  const tableName = "Orders";

  const columnsResult = await pgPool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position;
      `,
    [tableName]
  );

  if (columnsResult.rows.length === 0) {
    return {
      status: 404,
      body: {
        success: false,
        message: `Таблица "${tableName}" не найдена в схеме public`,
      },
    };
  }

  const columnNames = new Set(columnsResult.rows.map((row) => row.column_name));

  // Маппинг: выходное имя -> реальная колонка в БД
  const colMap = {};
  for (const outName of OUTPUT_COLUMNS) {
    const realCol = resolveColumn(columnNames, COLUMN_CANDIDATES[outName] || [outName]);
    if (realCol) colMap[outName] = realCol;
  }

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (onlyActive) {
    const stateCol = colMap.State;
    if (!stateCol) {
      return {
        status: 400,
        body: { error: "Не найдена колонка State в таблице Orders" },
      };
    }
    conditions.push(`"${stateCol}" = $${paramIndex++}`);
    params.push(ACTIVE_STATE);
  }

  // today=1 -> фильтр только за текущий день;
  // иначе AuctionDate (YYYYMMDD / YYYY-MM-DD) -> сравнение с датой заявки
  const todayFlag = String(req.query.today ?? "").toLowerCase();
  const today = todayFlag === "1" || todayFlag === "true" || todayFlag === "yes";
  const auctionDateIso = formatYyyymmdd(req.query.AuctionDate);
  if (colMap.OrderDateTime) {
    const dtCol = colMap.OrderDateTime;
    if (today) {
      conditions.push(`"${dtCol}" >= CURRENT_DATE AND "${dtCol}" < (CURRENT_DATE + interval '1 day')`);
    } else if (auctionDateIso) {
      conditions.push(`"${dtCol}"::date = $${paramIndex++}::date`);
      params.push(auctionDateIso);
    }
  }

  // Фильтры по всем столбцам
  for (const outName of OUTPUT_COLUMNS) {
    const value = req.query[outName];
    if (value == null || value === "") continue;

    const realCol = colMap[outName];
    if (!realCol) continue;

    params.push(value);
    conditions.push(`"${realCol}" = $${paramIndex++}`);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const selectParts = Object.entries(colMap).map(([out, real]) => `"${real}" AS "${out}"`);
  const orderBy = colMap.OrderDateTime
    ? `"${colMap.OrderDateTime}" DESC NULLS LAST`
    : colMap.OrderNum
      ? `"${colMap.OrderNum}" ASC`
      : "";
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";

  const query = `
      SELECT ${selectParts.join(", ")}
      FROM public."${tableName}"${whereClause}${orderClause}
    `;

  const result = await pgPool.query(query, params);
  return { status: 200, body: result.rows };
}

/**
 * GET /api/orders
 * Возвращает только активные заявки (State = "Активна") с полями:
 * OrderNum, ClassCode, SecCode, Price, Qty, Value, OrderDateTime, Operation, State, FirmName.
 * Фильтрация по всем указанным столбцам через query-параметры.
 */
export async function getOrders(req, res, next) {
  try {
    const result = await queryOrders({ req, onlyActive: true });
    return res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/all
 * Возвращает все заявки (без ограничения по State).
 */
export async function getAllOrders(req, res, next) {
  try {
    const result = await queryOrders({ req, onlyActive: false });
    return res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
}

async function queryTrades(req) {
  const columnsResult = await pgPool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position;
      `,
    [TRADE_TABLE_NAME]
  );

  if (columnsResult.rows.length === 0) {
    return {
      status: 404,
      body: {
        success: false,
        message: `Таблица "${TRADE_TABLE_NAME}" не найдена в схеме public`,
      },
    };
  }

  const columnNames = new Set(columnsResult.rows.map((row) => row.column_name));
  const colMap = {};
  for (const outName of TRADE_OUTPUT_COLUMNS) {
    const realCol = resolveColumn(
      columnNames,
      TRADE_COLUMN_CANDIDATES[outName] || [outName]
    );
    if (realCol) colMap[outName] = realCol;
  }

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  const auctionDateIso = formatYyyymmdd(req.query.AuctionDate);
  if (colMap.TradeDateTime && auctionDateIso) {
    conditions.push(`"${colMap.TradeDateTime}"::date = $${paramIndex++}::date`);
    params.push(auctionDateIso);
  }

  for (const outName of TRADE_OUTPUT_COLUMNS) {
    const value = req.query[outName];
    if (value == null || value === "") continue;

    const realCol = colMap[outName];
    if (!realCol) continue;

    params.push(value);
    conditions.push(`"${realCol}" = $${paramIndex++}`);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const selectParts = Object.entries(colMap).map(([out, real]) => `"${real}" AS "${out}"`);
  const orderBy = colMap.TradeDateTime
    ? `"${colMap.TradeDateTime}" DESC NULLS LAST`
    : colMap.TradeNum
      ? `"${colMap.TradeNum}" DESC NULLS LAST`
      : "";
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";

  const query = `
      SELECT ${selectParts.join(", ")}
      FROM public."${TRADE_TABLE_NAME}"${whereClause}${orderClause}
    `;

  const result = await pgPool.query(query, params);
  return { status: 200, body: result.rows };
}

/**
 * GET /api/orders/trades/all
 * Возвращает сделки из таблицы Trades.
 */
export async function getAllTrades(req, res, next) {
  try {
    const result = await queryTrades(req);
    return res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
}
