import pgPool from "../config/dbPostgres.js";

const RULES_TABLE = "public.trade_class_rules";
const CLASSES_TABLE = 'public."Classes"';

/**
 * Список классов из QUIK Classes + назначенный market_type (первичка/вторичка).
 * @param {{ search?: string, market_type?: string|null }} opts
 */
export async function listClassRegistry({ search = "", market_type = null } = {}) {
  const params = [];
  const outerConditions = [];

  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    outerConditions.push(
      `(base.class_code ILIKE $${params.length}
        OR COALESCE(base.class_name, '') ILIKE $${params.length})`
    );
  }

  if (market_type === "unset") {
    outerConditions.push(`r.market_type IS NULL`);
  } else if (market_type === "primary" || market_type === "secondary") {
    params.push(market_type);
    outerConditions.push(`r.market_type = $${params.length}`);
  }

  const where = outerConditions.length ? `WHERE ${outerConditions.join(" AND ")}` : "";

  const result = await pgPool.query(
    `
    SELECT
      base.class_code,
      base.class_name,
      base.class_type,
      base.trade_date,
      r.market_type,
      r.id AS rule_id
    FROM (
      SELECT DISTINCT ON (c."ClassCode")
        c."ClassCode" AS class_code,
        c."ClassName" AS class_name,
        c."ClassType" AS class_type,
        c."TradeDate" AS trade_date
      FROM ${CLASSES_TABLE} c
      WHERE c."ClassCode" IS NOT NULL
        AND c."ClassCode" <> ''
      ORDER BY c."ClassCode", c."TradeDate" DESC NULLS LAST
    ) base
    LEFT JOIN ${RULES_TABLE} r ON r.class_code = base.class_code
    ${where}
    ORDER BY base.class_code
    `,
    params
  );

  return result.rows.map((row) => ({
    class_code: row.class_code,
    class_name: row.class_name ?? null,
    class_type: row.class_type ?? null,
    trade_date: row.trade_date ?? null,
    market_type: row.market_type ?? null,
    rule_id: row.rule_id ?? null,
  }));
}

/**
 * Коды классов с market_type = primary (первичный рынок / аукционы).
 */
export async function listPrimaryClassCodes() {
  const result = await pgPool.query(
    `
    SELECT DISTINCT class_code
    FROM ${RULES_TABLE}
    WHERE market_type = 'primary'
      AND class_code IS NOT NULL
      AND class_code <> ''
    ORDER BY class_code
    `
  );
  return result.rows.map((r) => String(r.class_code).trim()).filter(Boolean);
}

/**
 * @param {string} classCode
 */
export async function findClassInQuik(classCode) {
  const result = await pgPool.query(
    `
    SELECT DISTINCT ON (c."ClassCode")
      c."ClassCode" AS class_code,
      c."ClassName" AS class_name,
      c."ClassType" AS class_type
    FROM ${CLASSES_TABLE} c
    WHERE c."ClassCode" = $1
    ORDER BY c."ClassCode", c."TradeDate" DESC NULLS LAST
    `,
    [classCode]
  );
  return result.rows[0] || null;
}

/**
 * Назначить первичка/вторичка или снять назначение (market_type = null).
 * @param {string} classCode
 * @param {'primary'|'secondary'|null} marketType
 */
export async function upsertClassMarketType(classCode, marketType) {
  const quikClass = await findClassInQuik(classCode);
  if (!quikClass) return { ok: false, reason: "NOT_FOUND" };

  if (marketType == null) {
    await pgPool.query(`DELETE FROM ${RULES_TABLE} WHERE class_code = $1`, [classCode]);
    return {
      ok: true,
      row: {
        class_code: quikClass.class_code,
        class_name: quikClass.class_name ?? null,
        class_type: quikClass.class_type ?? null,
        market_type: null,
        rule_id: null,
      },
    };
  }

  const result = await pgPool.query(
    `
    INSERT INTO ${RULES_TABLE} (class_code, class_name, market_type)
    VALUES ($1, $2, $3)
    ON CONFLICT (class_code) DO UPDATE
      SET class_name = EXCLUDED.class_name,
          market_type = EXCLUDED.market_type
    RETURNING id, class_code, class_name, market_type
    `,
    [classCode, quikClass.class_name ?? null, marketType]
  );

  const row = result.rows[0];
  return {
    ok: true,
    row: {
      class_code: row.class_code,
      class_name: row.class_name ?? quikClass.class_name ?? null,
      class_type: quikClass.class_type ?? null,
      market_type: row.market_type,
      rule_id: row.id,
    },
  };
}
