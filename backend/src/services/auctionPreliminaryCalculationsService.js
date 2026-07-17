import pgPool from "../config/dbPostgres.js";

let tableReadyPromise = null;

async function ensureTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS auction_preliminary_calculations (
          id               BIGSERIAL PRIMARY KEY,
          auction_id       TEXT        NOT NULL,
          class_code       VARCHAR(12) NOT NULL,
          sec_code         VARCHAR(12) NOT NULL,
          trade_date       DATE,
          offered_qty      NUMERIC(20, 4) NOT NULL,
          cut_off_price    NUMERIC(20, 4),
          requested_qty    NUMERIC(20, 4) NOT NULL DEFAULT 0,
          distributed_qty  NUMERIC(20, 4) NOT NULL DEFAULT 0,
          coverage_pct     NUMERIC(10, 4) NOT NULL DEFAULT 0,
          rows             JSONB       NOT NULL DEFAULT '[]'::jsonb,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_auction_prelim_calc_auction_created
          ON auction_preliminary_calculations (auction_id, created_at DESC);
      `);

      // Для уже существующих таблиц без cut_off_price
      await pgPool.query(`
        ALTER TABLE auction_preliminary_calculations
          ADD COLUMN IF NOT EXISTS cut_off_price NUMERIC(20, 4);
      `);
    })();
  }

  await tableReadyPromise;
}

function mapRow(row) {
  if (!row) return null;

  const cutOff =
    row.cut_off_price != null && Number.isFinite(Number(row.cut_off_price))
      ? Number(row.cut_off_price)
      : null;

  return {
    id: Number(row.id),
    auctionId: row.auction_id,
    classCode: row.class_code,
    secCode: row.sec_code,
    tradeDate: row.trade_date,
    offeredQty: Number(row.offered_qty),
    cutOffPrice: cutOff != null && cutOff > 0 ? cutOff : undefined,
    requestedQty: Number(row.requested_qty),
    distributedQty: Number(row.distributed_qty),
    coveragePct: Number(row.coverage_pct),
    rows: Array.isArray(row.rows) ? row.rows : [],
    createdAt: row.created_at,
  };
}

export async function savePreliminaryCalculation(payload) {
  await ensureTable();

  const result = await pgPool.query(
    `
      INSERT INTO auction_preliminary_calculations (
        auction_id,
        class_code,
        sec_code,
        trade_date,
        offered_qty,
        cut_off_price,
        requested_qty,
        distributed_qty,
        coverage_pct,
        rows
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING *
    `,
    [
      payload.auctionId,
      payload.classCode,
      payload.secCode,
      payload.tradeDate || null,
      payload.offeredQty,
      payload.cutOffPrice != null && payload.cutOffPrice > 0
        ? payload.cutOffPrice
        : null,
      payload.requestedQty,
      payload.distributedQty,
      payload.coveragePct,
      JSON.stringify(payload.rows ?? []),
    ],
  );

  return mapRow(result.rows[0]);
}

export async function getLatestPreliminaryCalculation(auctionId) {
  await ensureTable();

  const result = await pgPool.query(
    `
      SELECT *
      FROM auction_preliminary_calculations
      WHERE auction_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [auctionId],
  );

  return mapRow(result.rows[0]);
}

export async function getPreliminaryCalculationHistory(auctionId, limit = 20) {
  await ensureTable();

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const result = await pgPool.query(
    `
      SELECT *
      FROM auction_preliminary_calculations
      WHERE auction_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [auctionId, safeLimit],
  );

  return result.rows.map(mapRow).filter(Boolean);
}
