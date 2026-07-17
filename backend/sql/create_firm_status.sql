-- Справочник статусов фирм и назначения статусов (БД quik_kse)
-- Выполнить: npm run kse:firm-status-table
-- или: node scripts/run-firm-status-sql.js

-- Справочник значений status
CREATE TABLE IF NOT EXISTS public.firm_status_dict (
  id         SERIAL PRIMARY KEY,
  name_ru    VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.firm_status_dict (name_ru) VALUES
  ('Финансовые институты'),
  ('Институциональные инвесторы'),
  ('страховые компании'),
  ('Инвесторы')
ON CONFLICT (name_ru) DO NOTHING;

-- Назначения: firm_id из QUIK.Firms.FirmId, status → firm_status_dict, resident true/false
CREATE TABLE IF NOT EXISTS public.firm_status (
  firm_id    VARCHAR(12) PRIMARY KEY,
  status     INTEGER REFERENCES public.firm_status_dict (id) ON DELETE SET NULL,
  resident   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firm_status_status
  ON public.firm_status (status);

CREATE INDEX IF NOT EXISTS idx_firm_status_resident
  ON public.firm_status (resident);
