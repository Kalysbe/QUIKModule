// controllers/auctionsController.js
import { z } from "zod";
import { createStoredProcedureHandler } from "../utils/storedProcedureHelper.js";
import { sql } from "../config/dbMssql.js";
import pgPool from "../config/dbPostgres.js";
import { queryAuctionOrders, getOrdersColumnMap, formatYyyymmdd } from "../services/auctionOrdersQuery.js";
import {
    savePreliminaryCalculation as savePreliminaryCalculationToDb,
    getLatestPreliminaryCalculation as getLatestPreliminaryCalculationFromDb,
    getPreliminaryCalculationHistory as getPreliminaryCalculationHistoryFromDb,
} from "../services/auctionPreliminaryCalculationsService.js";
import { getCompletedAuctions } from "../services/completedAuctionsService.js";

/* =========================
   AddAuctionSchedule - Добавление аукциона
   ========================= */
export const addAuctionSchedule = createStoredProcedureHandler(
    z.object({
        ClassCode: z.string().max(12),
        SecCode: z.string().max(12),
        IssuerCode: z.string().max(12),
        IssuerClientCode: z.string().max(12).nullable().optional(),
        OperatorCode: z.string().max(12),
        AuctionKind: z.number().int(),
        CustomAuctionId: z.number().int(),
        ParentCustomAuctionId: z.number().int().nullable().optional(),
        AuctionQty: z.number().int(),
        BuySell: z.number().int().min(0).max(1),
        AuctionDate: z.number().int(),
        OrderEntryPhaseStartTime: z.number().int(),
        OrderEntryPhaseDuration: z.number().int(),
        FulfillmentPhaseDuration: z.number().int(),
        OrderEntryNonCompetitiveEnabled: z.number().int().min(0).max(1),
        OrderExecutionModeByCutOffPriceEnabled: z.number().int().min(0).max(1),
        OrderPartialFulfillmentEnabled: z.number().int().min(0).max(1),
        OrderBooksDisabled: z.number().int().min(0).max(1),
        NoncompetitiveOrdersPercent: z.number(),
        MinAllowedPrice: z.number(),
        MaxAllowedPrice: z.number().optional(),
        IssuerOrderInOrderEntryPeriodEnabled: z.number().int().min(0).max(1).optional(),
    }),
    "AddAuctionSchedule",
    {
        ClassCode: sql.VarChar(12), SecCode: sql.VarChar(12), IssuerCode: sql.VarChar(12),
        IssuerClientCode: sql.VarChar(12), OperatorCode: sql.VarChar(12), AuctionKind: sql.Int,
        CustomAuctionId: sql.BigInt, ParentCustomAuctionId: sql.BigInt, AuctionQty: sql.BigInt,
        BuySell: sql.Int, AuctionDate: sql.Int, OrderEntryPhaseStartTime: sql.Int,
        OrderEntryPhaseDuration: sql.Int, FulfillmentPhaseDuration: sql.Int,
        OrderEntryNonCompetitiveEnabled: sql.Int, OrderExecutionModeByCutOffPriceEnabled: sql.Int,
        OrderPartialFulfillmentEnabled: sql.Int, OrderBooksDisabled: sql.Int,
        NoncompetitiveOrdersPercent: sql.Float, MinAllowedPrice: sql.Float, MaxAllowedPrice: sql.Float,
        IssuerOrderInOrderEntryPeriodEnabled: sql.Int,
    },
    ["IssuerClientCode", "ParentCustomAuctionId", "MaxAllowedPrice", "IssuerOrderInOrderEntryPeriodEnabled"],
    "Аукцион успешно добавлен"
);

/* =========================
   EditAuctionSchedule - Редактирование аукциона
   ========================= */
export const editAuctionSchedule = createStoredProcedureHandler(
    z.object({
        CustomAuctionId: z.number().int(),
        IssuerCode: z.string().max(12),
        IssuerClientCode: z.string().max(12).nullable().optional(),
        OperatorCode: z.string().max(12),
        AuctionDate: z.number().int(),
        AuctionQty: z.number().int(),
        OrderEntryPhaseStartTime: z.number().int(),
        OrderEntryPhaseDuration: z.number().int(),
        FulfillmentPhaseDuration: z.number().int(),
        OrderEntryNonCompetitiveEnabled: z.number().int().min(0).max(1),
        OrderExecutionModeByCutOffPriceEnabled: z.number().int().min(0).max(1),
        OrderPartialFulfillmentEnabled: z.number().int().min(0).max(1),
        OrderBooksDisabled: z.number().int().min(0).max(1),
        NoncompetitiveOrdersPercent: z.number(),
        MinAllowedPrice: z.number(),
        MaxAllowedPrice: z.number(),
        IssuerOrderInOrderEntryPeriodEnabled: z.number().int().min(0).max(1).optional(),
    }),
    "EditAuctionSchedule",
    {
        CustomAuctionId: sql.BigInt, IssuerCode: sql.VarChar(12), IssuerClientCode: sql.VarChar(12),
        OperatorCode: sql.VarChar(12), AuctionDate: sql.Int, AuctionQty: sql.BigInt,
        OrderEntryPhaseStartTime: sql.Int, OrderEntryPhaseDuration: sql.Int, FulfillmentPhaseDuration: sql.Int,
        OrderEntryNonCompetitiveEnabled: sql.Int, OrderExecutionModeByCutOffPriceEnabled: sql.Int,
        OrderPartialFulfillmentEnabled: sql.Int, OrderBooksDisabled: sql.Int,
        NoncompetitiveOrdersPercent: sql.Float, MinAllowedPrice: sql.Float, MaxAllowedPrice: sql.Float,
        IssuerOrderInOrderEntryPeriodEnabled: sql.Int,
    },
    ["IssuerClientCode", "IssuerOrderInOrderEntryPeriodEnabled"],
    "Аукцион успешно изменён"
);

/* =========================
   DeleteAuctionSchedule - Удаление аукциона
   ========================= */
export const deleteAuctionSchedule = createStoredProcedureHandler(
    z.object({ CustomAuctionId: z.number().int() }),
    "DeleteAuctionSchedule",
    { CustomAuctionId: sql.Int },
    [], "Аукцион успешно удалён"
);

/* =========================
   ChangeAuctionNotificationTime - Изменение времени нотификации
   ========================= */
export const changeAuctionNotificationTime = createStoredProcedureHandler(
    z.object({
        AuctionId: z.number().int(),
        Action: z.number().int().min(1).max(2),
        Time: z.number().int(),
        TemplateId: z.number().int(),
    }),
    "ChangeAuctionNotificationTime",
    { AuctionId: sql.Int, Action: sql.Int, Time: sql.Int, TemplateId: sql.Int },
    [], "Время нотификации изменено"
);

/* =========================
   ChangeAuctionDateAndTime - Изменение всех параметров расписания
   ========================= */
export const changeAuctionDateAndTime = createStoredProcedureHandler(
    z.object({
        AuctionId: z.number().int(),
        AuctionDate: z.number().int(),
        OrderEntryPhaseStartTime: z.number().int(),
        OrderEntryPhaseDuration: z.number().int(),
        IssuerPhaseDuration: z.number().int(),
    }),
    "ChangeAuctionDateAndTime",
    {
        AuctionId: sql.Int, AuctionDate: sql.Int, OrderEntryPhaseStartTime: sql.Int,
        OrderEntryPhaseDuration: sql.Int, IssuerPhaseDuration: sql.Int,
    },
    [], "Расписание аукциона изменено"
);

/* =========================
   ChangeAuctionTime - Изменение периодов и времени начала
   ========================= */
export const changeAuctionTime = createStoredProcedureHandler(
    z.object({
        AuctionId: z.number().int(),
        Action: z.number().int().min(1).max(3),
        Value: z.number().int(),
    }),
    "ChangeAuctionTime",
    { AuctionId: sql.Int, Action: sql.Int, Value: sql.Int },
    [], "Время аукциона изменено"
);

// ----------------------------------------------------------------------
// Auction profile helpers (Orders from PostgreSQL)

/**
 * GET /api/auctions/orders
 * Query: ClassCode, SecCode, AuctionDate(YYYYMMDD), today(0/1)
 * Returns: active orders for given instrument (and date filter when possible)
 */
export async function getAuctionOrders(req, res, next) {
    try {
        const schema = z.object({
            ClassCode: z.string().min(1).max(12),
            SecCode: z.string().min(1).max(12),
            AuctionDate: z.string().optional(),
            today: z.string().optional(),
        });
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Ошибка валидации данных",
                errors: parsed.error?.errors?.map((e) => ({
                    field: e.path?.join(".") || "",
                    message: e.message || "Ошибка валидации",
                })) || [{ message: "Ошибка валидации данных" }],
            });
        }

        const { ClassCode, SecCode } = parsed.data;
        const todayFlag = String(parsed.data.today ?? "").toLowerCase();
        const today = todayFlag === "1" || todayFlag === "true" || todayFlag === "yes";

        const result = await queryAuctionOrders({
            ClassCode,
            SecCode,
            AuctionDate: parsed.data.AuctionDate,
            today,
        });

        if (!result.ok) {
            return res.status(404).json({
                success: false,
                message: result.reason,
            });
        }

        return res.json({ success: true, items: result.rows });
    } catch (err) {
        return next(err);
    }
}

// ----------------------------------------------------------------------
// Allocation logic + tri export

function allocateFloorRemainderLast(rows, auctionQty, { basis = "qty" } = {}) {
    const getReq = (r) => {
        if (basis === "value") return Number(r?.Value) || 0;
        return Number(r?.Qty) || 0;
    };

    const qtyTotal = rows.reduce((acc, r) => acc + getReq(r), 0);
    const A = Number(auctionQty) || 0;

    const out = rows.map((r) => ({
        ...r,
        originalQty: getReq(r),
        approvedQty: getReq(r),
        rawApproved: getReq(r),
    }));

    if (A <= 0 || qtyTotal <= 0) {
        return { items: out.map(({ rawApproved, ...x }) => x), totalDemand: qtyTotal, auctionQty: A, oversubscribed: qtyTotal > A };
    }

    if (qtyTotal <= A) {
        return { items: out.map(({ rawApproved, ...x }) => x), totalDemand: qtyTotal, auctionQty: A, oversubscribed: false };
    }

    const k = A / qtyTotal;

    let sumApproved = 0;
    for (const r of out) {
        const raw = r.originalQty * k;
        let appr = Math.floor(raw);
        if (raw > 0 && appr < 1) appr = 1;
        if (appr > r.originalQty) appr = r.originalQty;
        r.rawApproved = raw;
        r.approvedQty = appr;
        sumApproved += appr;
    }

    let remaining = A - sumApproved;
    if (remaining > 0 && out.length > 0) {
        const last = out[out.length - 1];
        const canAdd = Math.max(0, last.originalQty - last.approvedQty);
        const add = Math.min(remaining, canAdd);
        last.approvedQty += add;
        remaining -= add;
    }

    return {
        items: out.map(({ rawApproved, ...x }) => x),
        totalDemand: qtyTotal,
        auctionQty: A,
        oversubscribed: true,
        remainingAfter: remaining,
        coefficient: k,
    };
}

const AllocateSchema = z.object({
    ClassCode: z.string().min(1).max(12),
    SecCode: z.string().min(1).max(12),
    AuctionDate: z.string().optional(), // YYYYMMDD
    // Общий объём может использоваться как "подсказка", но распределение делаем по отдельным объемам
    AuctionQty: z.number().int().nonnegative().optional(),
    CutOffPrice: z.number(),
    CompetitiveVolume: z.number().int().nonnegative().optional(),
    NonCompetitiveVolume: z.number().int().nonnegative().optional(),
    today: z.number().int().min(0).max(1).optional(),
});

function parseNum(v) {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function splitOrdersByCompetition(rows, cutOffPrice) {
    const cutoff = Number(cutOffPrice) || 0;
    const competitive = [];
    const noncompetitive = [];
    const rejectedByCutoff = [];

    for (const r of rows) {
        const p = parseNum(r?.Price);
        if (p === 0) {
            noncompetitive.push(r);
        } else if (p != null && p > 0) {
            if (p >= cutoff) competitive.push(r);
            else rejectedByCutoff.push(r);
        } else {
            // если нет Price — считаем конкурентной только если cutoff=0
            if (cutoff === 0) competitive.push(r);
            else rejectedByCutoff.push(r);
        }
    }

    return { competitive, noncompetitive, rejectedByCutoff, cutoff };
}

function sumRequestedValue(rows) {
    return (rows ?? []).reduce((acc, r) => acc + (Number(r?.Value) || 0), 0);
}

export async function allocateAuction(req, res, next) {
    try {
        const parsed = AllocateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Ошибка валидации данных",
                errors: parsed.error?.errors?.map((e) => ({
                    field: e.path?.join(".") || "",
                    message: e.message || "Ошибка валидации",
                })) || [{ message: "Ошибка валидации данных" }],
            });
        }

        // reuse query logic
        const { ClassCode, SecCode, AuctionDate, today, CutOffPrice } = parsed.data;
        const fakeReq = { query: { ClassCode, SecCode, AuctionDate, today: String(today ?? "") } };
        // fetch orders by calling internal helper directly
        const col = await getOrdersColumnMap();
        if (!col || !col.State || !col.SecCode || !col.ClassCode || !col.Qty) {
            return res.status(404).json({ success: false, message: 'Таблица "Orders" или колонки не найдены' });
        }

        const selectPairs = [
            col.OrderNum ? `"${col.OrderNum}" AS "OrderNum"` : null,
            `"${col.ClassCode}" AS "ClassCode"`,
            `"${col.SecCode}" AS "SecCode"`,
            col.ClientCode ? `"${col.ClientCode}" AS "ClientCode"` : null,
            col.Account ? `"${col.Account}" AS "Account"` : null,
            col.Price ? `"${col.Price}" AS "Price"` : null,
            `"${col.Qty}" AS "Qty"`,
            col.OrderDateTime ? `"${col.OrderDateTime}" AS "OrderDateTime"` : null,
            col.Operation ? `"${col.Operation}" AS "Operation"` : null,
        ].filter(Boolean);

        const conditions = [];
        const params = [];
        params.push("Активна");
        conditions.push(`"${col.State}" = $${params.length}`);
        params.push(ClassCode);
        conditions.push(`"${col.ClassCode}" = $${params.length}`);
        params.push(SecCode);
        conditions.push(`"${col.SecCode}" = $${params.length}`);

        const auctionDateIso = AuctionDate ? formatYyyymmdd(AuctionDate) : null;
        const useToday = Boolean(today);
        if (col.OrderDateTime) {
            if (useToday) {
                conditions.push(`"${col.OrderDateTime}" >= CURRENT_DATE AND "${col.OrderDateTime}" < (CURRENT_DATE + interval '1 day')`);
            } else if (auctionDateIso) {
                conditions.push(`"${col.OrderDateTime}"::date = $${params.length + 1}::date`);
                params.push(auctionDateIso);
            }
        }

        const orderBy = col.OrderDateTime
            ? `ORDER BY "${col.OrderDateTime}" ASC NULLS LAST`
            : col.OrderNum
                ? `ORDER BY "${col.OrderNum}" ASC`
                : "";

        const q = `
      SELECT ${selectPairs.join(", ")}
      FROM public."Orders"
      WHERE ${conditions.join(" AND ")}
      ${orderBy}
      LIMIT 5000
    `;
        const result = await pgPool.query(q, params);
        const rows = Array.isArray(result.rows) ? result.rows : [];
        const { competitive, noncompetitive, rejectedByCutoff, cutoff } = splitOrdersByCompetition(
            rows,
            CutOffPrice
        );

        // Если объёмы не заданы — считаем, что утверждаем всем полностью (в пределах заявленного Value)
        const compVol =
            typeof parsed.data.CompetitiveVolume === "number"
                ? parsed.data.CompetitiveVolume
                : Math.trunc(sumRequestedValue(competitive));
        const nonCompVol =
            typeof parsed.data.NonCompetitiveVolume === "number"
                ? parsed.data.NonCompetitiveVolume
                : Math.trunc(sumRequestedValue(noncompetitive));

        const allocCompetitive = allocateFloorRemainderLast(competitive, compVol, { basis: "value" });
        const allocNonCompetitive = allocateFloorRemainderLast(noncompetitive, nonCompVol, { basis: "value" });

        return res.json({
            success: true,
            cutoff,
            volumes: { competitive: compVol, noncompetitive: nonCompVol },
            competitive: allocCompetitive,
            noncompetitive: allocNonCompetitive,
            rejectedByCutoff,
        });
    } catch (err) {
        return next(err);
    }
}

function toTriLines(items) {
    let transId = 1;
    return items
        .filter((it) => Number(it.approvedQty) > 0)
        .map((it) => {
            const parts = [];
            parts.push(`TRANS_ID=${transId++}`);
            parts.push(`CLASSCODE=${it.ClassCode ?? ""}`);
            parts.push(`ACTION=Ввод заявки`);
            parts.push(`Инструмент=${it.SecCode ?? ""}`);
            // best-effort: если есть ClientCode — добавим в Комментарий, чтобы не потерять
            const comment = it.ClientCode ? `ClientCode=${it.ClientCode}` : "";
            parts.push(`Торговый счет=${it.Account ?? ""}`);
            parts.push(`К/П=${String(it.Operation ?? "").includes("B") ? "Покупка" : String(it.Operation ?? "").includes("S") ? "Продажа" : ""}`);
            parts.push(`Цена=${it.Price ?? ""}`);
            parts.push(`Количество=${it.approvedQty}`);
            parts.push(`Объем=0.00`);
            parts.push(`Комментарий=${comment}`);
            parts.push(`Тип=Лимитированная`);
            parts.push(`Условие исполнения=Поставить в очередь`);
            parts.push(`Количество/Объем=Количество`);
            parts.push(`Номер встречной заявки=`);
            return `${parts.join(";")};`;
        });
}

export async function downloadAllocationTri(req, res, next) {
    try {
        const parsed = AllocateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Ошибка валидации данных",
            });
        }

        // run allocation
        const { ClassCode, SecCode, AuctionDate, today, CutOffPrice } = parsed.data;
        const col = await getOrdersColumnMap();
        if (!col || !col.State || !col.SecCode || !col.ClassCode || !col.Qty) {
            return res.status(404).json({ success: false, message: 'Таблица "Orders" или колонки не найдены' });
        }

        const selectPairs = [
            col.OrderNum ? `"${col.OrderNum}" AS "OrderNum"` : null,
            `"${col.ClassCode}" AS "ClassCode"`,
            `"${col.SecCode}" AS "SecCode"`,
            col.ClientCode ? `"${col.ClientCode}" AS "ClientCode"` : null,
            col.Account ? `"${col.Account}" AS "Account"` : null,
            col.Price ? `"${col.Price}" AS "Price"` : null,
            `"${col.Qty}" AS "Qty"`,
            col.OrderDateTime ? `"${col.OrderDateTime}" AS "OrderDateTime"` : null,
            col.Operation ? `"${col.Operation}" AS "Operation"` : null,
        ].filter(Boolean);

        const conditions = [];
        const params = [];
        params.push("Активна");
        conditions.push(`"${col.State}" = $${params.length}`);
        params.push(ClassCode);
        conditions.push(`"${col.ClassCode}" = $${params.length}`);
        params.push(SecCode);
        conditions.push(`"${col.SecCode}" = $${params.length}`);

        const auctionDateIso = AuctionDate ? formatYyyymmdd(AuctionDate) : null;
        const useToday = Boolean(today);
        if (col.OrderDateTime) {
            if (useToday) {
                conditions.push(`"${col.OrderDateTime}" >= CURRENT_DATE AND "${col.OrderDateTime}" < (CURRENT_DATE + interval '1 day')`);
            } else if (auctionDateIso) {
                conditions.push(`"${col.OrderDateTime}"::date = $${params.length + 1}::date`);
                params.push(auctionDateIso);
            }
        }

        const orderBy = col.OrderDateTime
            ? `ORDER BY "${col.OrderDateTime}" ASC NULLS LAST`
            : col.OrderNum
                ? `ORDER BY "${col.OrderNum}" ASC`
                : "";

        const q = `
      SELECT ${selectPairs.join(", ")}
      FROM public."Orders"
      WHERE ${conditions.join(" AND ")}
      ${orderBy}
      LIMIT 5000
    `;
        const result = await pgPool.query(q, params);
        const rows = Array.isArray(result.rows) ? result.rows : [];
        const { competitive, noncompetitive, cutoff } = splitOrdersByCompetition(rows, CutOffPrice);
        const compVol =
            typeof parsed.data.CompetitiveVolume === "number"
                ? parsed.data.CompetitiveVolume
                : Math.trunc(sumRequestedValue(competitive));
        const nonCompVol =
            typeof parsed.data.NonCompetitiveVolume === "number"
                ? parsed.data.NonCompetitiveVolume
                : Math.trunc(sumRequestedValue(noncompetitive));

        const allocCompetitive = allocateFloorRemainderLast(competitive, compVol, { basis: "value" });
        const allocNonCompetitive = allocateFloorRemainderLast(noncompetitive, nonCompVol, { basis: "value" });

        // Секции в tri: сначала конкурентные, потом неконкурентные
        const lines = [
            `;CUT_OFF_PRICE=${cutoff};COMP_VOL=${compVol};NONCOMP_VOL=${nonCompVol};`,
            ...toTriLines(allocCompetitive.items),
            ...toTriLines(allocNonCompetitive.items),
        ];
        const content = lines.join("\n") + (lines.length ? "\n" : "");

        const yyyymmdd = AuctionDate && /^\d{8}$/.test(String(AuctionDate)) ? String(AuctionDate) : "Orders";
        const filename = `Orders_${yyyymmdd}.tri`;

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(content);
    } catch (err) {
        return next(err);
    }
}

const PreliminaryAllocationRowSchema = z.object({
    orderId: z.string(),
    type: z.enum(["competitive", "nonCompetitive"]),
    price: z.number(),
    yield: z.number().optional(),
    requested: z.number(),
    allocated: z.number(),
    requestedValue: z.number().optional(),
    allocatedValue: z.number().optional(),
    fulfillmentRate: z.number(),
});

const SavePreliminaryCalculationSchema = z.object({
    auctionId: z.string().min(1),
    classCode: z.string().max(12),
    secCode: z.string().max(12),
    tradeDate: z.string().nullable().optional(),
    offeredQty: z.number(),
    cutOffPrice: z.number().positive().optional(),
    requestedQty: z.number(),
    distributedQty: z.number(),
    coveragePct: z.number(),
    rows: z.array(PreliminaryAllocationRowSchema),
});

export async function savePreliminaryCalculation(req, res, next) {
    try {
        const parsed = SavePreliminaryCalculationSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Ошибка валидации данных",
                errors: parsed.error?.errors?.map((e) => ({
                    field: e.path?.join(".") || "",
                    message: e.message || "Ошибка валидации",
                })) || [{ message: "Ошибка валидации данных" }],
            });
        }

        const data = await savePreliminaryCalculationToDb(parsed.data);

        return res.json({
            success: true,
            message: "Предварительные расчёты сохранены",
            data,
        });
    } catch (err) {
        return next(err);
    }
}

export async function getLatestPreliminaryCalculation(req, res, next) {
    try {
        const auctionId = String(req.query.auction_id ?? req.query.auctionId ?? "").trim();
        if (!auctionId) {
            return res.status(400).json({
                success: false,
                message: "Параметр auction_id обязателен",
            });
        }

        const data = await getLatestPreliminaryCalculationFromDb(auctionId);

        return res.json({
            success: true,
            data,
        });
    } catch (err) {
        return next(err);
    }
}

export async function getPreliminaryCalculationHistory(req, res, next) {
    try {
        const auctionId = String(req.query.auction_id ?? req.query.auctionId ?? "").trim();
        if (!auctionId) {
            return res.status(400).json({
                success: false,
                message: "Параметр auction_id обязателен",
            });
        }

        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
        const data = await getPreliminaryCalculationHistoryFromDb(auctionId, limit);

        return res.json({
            success: true,
            data,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /api/auctions/completed
 * Публичный список завершённых аукционов (без JWT).
 * Завершён: TradeDate + endtime уже прошли относительно текущего времени.
 */
export async function getCompletedAuctionsList(req, res, next) {
    try {
        const result = await getCompletedAuctions({
            limit: req.query.limit !== undefined ? Number(req.query.limit) : undefined,
            offset: req.query.offset !== undefined ? Number(req.query.offset) : undefined,
        });

        return res.json({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({
                success: false,
                message: err.message,
            });
        }
        return next(err);
    }
}

