-- Предварительные расчёты распределения заявок по аукциону ГЦБ

CREATE TABLE IF NOT EXISTS auction_preliminary_calculations (
  id               BIGSERIAL PRIMARY KEY,
  auction_id       TEXT        NOT NULL,
  class_code       VARCHAR(12) NOT NULL,
  sec_code         VARCHAR(12) NOT NULL,
  trade_date       DATE,
  offered_qty      NUMERIC(20, 4) NOT NULL,
  requested_qty    NUMERIC(20, 4) NOT NULL DEFAULT 0,
  distributed_qty  NUMERIC(20, 4) NOT NULL DEFAULT 0,
  coverage_pct     NUMERIC(10, 4) NOT NULL DEFAULT 0,
  rows             JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_prelim_calc_auction_created
  ON auction_preliminary_calculations (auction_id, created_at DESC);
