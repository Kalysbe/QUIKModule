// controllers/paramsController.js
import pgPool from "../config/dbPostgres.js";
import pgKsePool from "../config/dbKse.js";

const PARAMS_TABLE_NAME = "Params";
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 200;
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Almaty";
const DEBUG_SQL = String(process.env.DEBUG_SQL ?? "").toLowerCase() === "true";

function debugSql(label, query, params) {
    if (!DEBUG_SQL) return;
    // Явный лог итогового SQL и параметров для отладки
    // eslint-disable-next-line no-console
    console.log(`[SQL][${label}]`, query);
    // eslint-disable-next-line no-console
    console.log(`[SQL][${label}] params:`, params);
}

function parsePagination(query) {
    const hasLimit = query.limit !== undefined;
    const hasOffset = query.offset !== undefined;

    let limit = DEFAULT_LIMIT;
    let offset = 0;

    if (hasLimit) {
        const parsed = Number(query.limit);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return { error: "Параметр limit должен быть целым числом >= 1" };
        }
        limit = Math.min(parsed, MAX_LIMIT);
    }

    if (hasOffset) {
        const parsed = Number(query.offset);
        if (!Number.isInteger(parsed) || parsed < 0) {
            return { error: "Параметр offset должен быть целым числом >= 0" };
        }
        offset = parsed;
    }

    return { limit, offset, hasPagination: hasLimit || hasOffset };
}

async function getParamsTableColumnsMeta() {
    const columnsResult = await pgPool.query(
        `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position;
        `,
        [PARAMS_TABLE_NAME]
    );

    if (columnsResult.rows.length === 0) {
        return null;
    }

    const orderedColumns = columnsResult.rows.map((row) => row.column_name);
    const columnNames = new Set(orderedColumns);
    const columnTypes = new Map(columnsResult.rows.map((r) => [r.column_name, r.data_type]));
    const lowerMap = new Map([...columnNames].map((c) => [c.toLowerCase(), c]));

    return { columnNames, columnTypes, lowerMap, orderedColumns };
}

/** Колонки Params, где в БД лежит «время суток» как datetime (например 1900-01-01 10:30:00). */
const PARAMS_TIME_OF_DAY_COLUMNS_LOWER = new Set([
    "starttime",
    "starttme",
    "endtime",
    "start_time",
    "end_time",
]);

function buildAuctionParamsSelectClause(meta) {
    const { orderedColumns, columnTypes, lowerMap } = meta;
    const tradeDateCol = lowerMap.get("tradedate");
    const parts = orderedColumns.map((col) => {
        const ql = col.toLowerCase();
        if (PARAMS_TIME_OF_DAY_COLUMNS_LOWER.has(ql)) {
            return `to_char(p."${col}"::time, 'HH24:MI:SS') AS "${col}"`;
        }
        if (tradeDateCol && col === tradeDateCol) {
            const quoted = `"${col}"`;
            const dtType = String(columnTypes.get(col) ?? "").toLowerCase();
            if (dtType.includes("date") && !dtType.includes("time")) {
                return `to_char(p.${quoted}::date, 'YYYY-MM-DD') AS "${col}"`;
            }
            if (dtType.includes("timestamp with time zone")) {
                return `to_char((p.${quoted} AT TIME ZONE '${APP_TIMEZONE}')::date, 'YYYY-MM-DD') AS "${col}"`;
            }
            return `to_char((p.${quoted})::date, 'YYYY-MM-DD') AS "${col}"`;
        }
        return `p."${col}"`;
    });
    return parts.join(", ");
}

function applyTodayFilter(conditions, params, columnTypes, lowerMap, todayRequested, appToday) {
    if (!todayRequested) return;

    const candidates = [
        "TradeDateTime", "tradedatetime",
        "ParamDateTime", "paramdatetime",
        "DateTime", "datetime",
        "UpdatedAt", "updatedat",
        "TradeDate", "tradedate",
        "Date", "date",
    ];

    let dtCol = null;
    for (const cand of candidates) {
        const real = lowerMap.get(String(cand).toLowerCase());
        if (real) {
            dtCol = real;
            break;
        }
    }

    if (!dtCol) {
        conditions.push("1 = 0");
        return;
    }
    if (!appToday) {
        conditions.push("1 = 0");
        return;
    }

    params.push(appToday);
    const dateParam = `$${params.length}::date`;

    const dtType = String(columnTypes.get(dtCol) ?? "").toLowerCase();
    if (dtType.includes("date") && !dtType.includes("time")) {
        conditions.push(`"${dtCol}" = ${dateParam}`);
    } else if (dtType.includes("timestamp without time zone")) {
        // Значение хранится как локальное "стеновое" время (без tz):
        // сравниваем напрямую по дате, без преобразования колонки в timezone.
        conditions.push(`("${dtCol}"::date = ${dateParam})`);
    } else if (dtType.includes("timestamp with time zone")) {
        // Для timestamptz приводим к дате в целевой timezone приложения.
        conditions.push(`(("${dtCol}" AT TIME ZONE '${APP_TIMEZONE}')::date = ${dateParam})`);
    } else {
        conditions.push(
            `(("${dtCol}"::timestamp AT TIME ZONE '${APP_TIMEZONE}')::date = ${dateParam})`
        );
    }
}

function resolveParamsClassCodeColumn(lowerMap) {
    // Для аукционного фильтра используем только точные имена,
    // чтобы не зацепить чужие поля вроде BaseClassCode/IssuerClassCode.
    return lowerMap.get("classcode") ?? lowerMap.get("class_code") ?? null;
}

function resolveParamsAuctionIdColumn(lowerMap) {
    return lowerMap.get("auction_id") ?? lowerMap.get("auctionid") ?? null;
}

function parseTodayFlag(value, defaultValue = true) {
    if (value === undefined || value === null || value === "") return defaultValue;
    const v = String(value).toLowerCase();
    if (v === "1" || v === "true" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "no") return false;
    return defaultValue;
}

function getAppToday() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return y && m && d ? `${y}-${m}-${d}` : null;
}

/**
 * GET /api/params/auction
 * Возвращает только те Params, где ClassCode относится к аукционным классам
 * из локального реестра quik_kse (trade_segment = auction), и auction_id IS NOT NULL.
 */
export async function getAuctionParams(req, res, next) {
    try {
        const pagination = parsePagination(req.query);
        if (pagination.error) {
            return res.status(400).json({ success: false, message: pagination.error });
        }

        const meta = await getParamsTableColumnsMeta();
        if (!meta) {
            return res.status(404).json({
                success: false,
                message: `Таблица "${PARAMS_TABLE_NAME}" не найдена в схеме public`,
            });
        }

        const { columnNames, columnTypes, lowerMap } = meta;
        const classCodeColumn = resolveParamsClassCodeColumn(lowerMap);
        if (!classCodeColumn) {
            return res.status(404).json({
                success: false,
                message: `В таблице "${PARAMS_TABLE_NAME}" не найден столбец ClassCode (или class_code)`,
            });
        }

        const auctionIdColumn = resolveParamsAuctionIdColumn(lowerMap);
        if (!auctionIdColumn) {
            return res.status(404).json({
                success: false,
                message: `В таблице "${PARAMS_TABLE_NAME}" не найден столбец auction_id`,
            });
        }

        const filters = { ...req.query };
        delete filters.limit;
        delete filters.offset;
        const conditions = [];
        const params = [];
        const appToday = getAppToday();

        const today = parseTodayFlag(filters.today, true);
        delete filters.today;

        applyTodayFilter(conditions, params, columnTypes, lowerMap, today, appToday);

        conditions.push(`"${auctionIdColumn}" IS NOT NULL`);

        const auctionClassesResult = await pgKsePool.query(
            `
            SELECT DISTINCT class_code
            FROM public.quik_class_registry
            WHERE trade_segment_id = 1
              AND class_code IS NOT NULL
              AND class_code <> ''
            `
        );
        const auctionClassCodes = [...new Set(
            auctionClassesResult.rows
                .map((r) => String(r.class_code ?? "").trim())
                .filter(Boolean)
        )];
        if (!auctionClassCodes.length) {
            return pagination.hasPagination
                ? res.json({ success: true, data: [], pagination: { limit: pagination.limit, offset: pagination.offset, count: 0 } })
                : res.json([]);
        }

        params.push(auctionClassCodes);
        conditions.push(`"${classCodeColumn}"::text = ANY($${params.length}::text[])`);

        for (const [key, value] of Object.entries(filters)) {
            if (!columnNames.has(key)) continue;
            params.push(value);
            conditions.push(`"${key}" = $${params.length}`);
        }

        const whereClause = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
        params.push(pagination.limit, pagination.offset);
        const selectClause = buildAuctionParamsSelectClause(meta);
        const query = `SELECT ${selectClause} FROM public."${PARAMS_TABLE_NAME}" p${whereClause} LIMIT $${params.length - 1} OFFSET $${params.length}`;
        debugSql("getAuctionParams", query, params);
        const result = await pgPool.query(query, params);
        const data = result.rows;
        if (!pagination.hasPagination) {
            return res.json(data);
        }
        res.json({
            success: true,
            data,
            pagination: {
                limit: pagination.limit,
                offset: pagination.offset,
                count: data.length,
            },
        });
    } catch (err) {
        next(err);
    }
}
