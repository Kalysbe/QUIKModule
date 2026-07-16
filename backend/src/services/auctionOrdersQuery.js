// Shared PostgreSQL query for active auction orders (HTTP + WebSocket).
import pgPool from "../config/dbPostgres.js";

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

export async function getOrdersColumnMap() {
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

    const names = new Set(columnsResult.rows.map((r) => r.column_name));
    if (names.size === 0) return null;

    const col = {
        OrderNum: resolveColumn(names, ["OrderNum", "ordernum", "order_num"]),
        ClassCode: resolveColumn(names, ["ClassCode", "classcode", "class_code"]),
        SecCode: resolveColumn(names, ["SecCode", "seccode", "sec_code"]),
        Price: resolveColumn(names, ["Price", "price"]),
        Qty: resolveColumn(names, ["Qty", "qty", "Quantity", "quantity"]),
        Value: resolveColumn(names, ["Value", "value", "Amount", "amount"]),
        Yield: resolveColumn(names, ["Yield", "yield", "DesiredYield", "desired_yield"]),
        OrderDateTime: resolveColumn(names, ["OrderDateTime", "orderdatetime", "order_date_time", "OrderDate", "orderdate", "order_date"]),
        Operation: resolveColumn(names, ["Operation", "operation"]),
        State: resolveColumn(names, ["State", "state", "Status", "status"]),
        ClientCode: resolveColumn(names, ["ClientCode", "clientcode", "client_code", "BrokerClientCode", "brokerclientcode", "broker_client_code"]),
        Account: resolveColumn(names, ["Account", "account", "TradeAccount", "tradeaccount", "TradeAcc", "tradeacc"]),
        EndTime: resolveColumn(names, ["EndTime", "endtime", "end_time"]),
    };

    return col;
}

/** Нормализует дату аукциона в ISO YYYY-MM-DD. Принимает YYYYMMDD или YYYY-MM-DD[.time]. */
export function formatYyyymmdd(n) {
    const s = String(n ?? "").trim();
    if (/^\d{8}$/.test(s)) {
        return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return null;
}

/**
 * @param {{ ClassCode?: string, SecCode: string, AuctionDate?: string, today?: boolean }} opts
 * @returns {Promise<{ ok: false, reason: string } | { ok: true, rows: object[] }>}
 */
export async function queryAuctionOrders(opts) {
    const SecCode = String(opts.SecCode ?? "").trim();
    const ClassCode = opts.ClassCode != null ? String(opts.ClassCode).trim() : "";
    if (!SecCode) {
        return { ok: false, reason: "SecCode required" };
    }

    const today = Boolean(opts.today);
    const auctionDateIso = opts.AuctionDate ? formatYyyymmdd(opts.AuctionDate) : null;

    const col = await getOrdersColumnMap();
    if (!col || !col.State || !col.SecCode) {
        return { ok: false, reason: 'Таблица "Orders" или ключевые колонки не найдены' };
    }
    if (ClassCode && !col.ClassCode) {
        return { ok: false, reason: "Колонка ClassCode не найдена в Orders" };
    }

    const selectPairs = Object.entries(col)
        .filter(([, v]) => Boolean(v))
        .map(([out, real]) => `"${real}" AS "${out}"`);

    const conditions = [];
    const params = [];

    params.push("Активна");
    conditions.push(`"${col.State}" = $${params.length}`);

    if (ClassCode) {
        params.push(ClassCode);
        conditions.push(`"${col.ClassCode}" = $${params.length}`);
    }

    params.push(SecCode);
    conditions.push(`"${col.SecCode}" = $${params.length}`);

    if (col.OrderDateTime) {
        if (today) {
            conditions.push(`"${col.OrderDateTime}" >= CURRENT_DATE AND "${col.OrderDateTime}" < (CURRENT_DATE + interval '1 day')`);
        } else if (auctionDateIso) {
            conditions.push(`"${col.OrderDateTime}"::date = $${params.length + 1}::date`);
            params.push(auctionDateIso);
        }
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const orderBy = col.OrderDateTime
        ? `ORDER BY "${col.OrderDateTime}" DESC NULLS LAST`
        : col.OrderNum
            ? `ORDER BY "${col.OrderNum}" ASC`
            : "";

    const q = `
      SELECT ${selectPairs.join(", ")}
      FROM public."Orders"
      ${where}
      ${orderBy}
      LIMIT 5000
    `;

    const result = await pgPool.query(q, params);
    return { ok: true, rows: result.rows };
}
