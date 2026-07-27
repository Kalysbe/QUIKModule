-- Локальные категории классов QUIK (БД QuikExport, POSTGRES_*)
-- Выполнить: psql ... -d QuikExport -f sql/create_quik_class_registry.sql
-- Или: node scripts/run-quik-class-registry-sql.js

CREATE TABLE IF NOT EXISTS public.quik_class_categories (
  id       SERIAL PRIMARY KEY,
  code     VARCHAR(32) NOT NULL UNIQUE,
  name_ru  VARCHAR(100) NOT NULL
);

INSERT INTO public.quik_class_categories (code, name_ru) VALUES
  ('corporate', 'Корпоративный'),
  ('precious_metal', 'Драгоценные металлы'),
  ('government', 'Государственный'),
  ('other', 'Прочее')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.quik_class_trade_segments (
  id       SERIAL PRIMARY KEY,
  code     VARCHAR(32) NOT NULL UNIQUE,
  name_ru  VARCHAR(100) NOT NULL
);

INSERT INTO public.quik_class_trade_segments (code, name_ru) VALUES
  ('auction', 'Аукцион'),
  ('secondary', 'Вторичка')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.quik_class_registry (
  class_code         VARCHAR(128) PRIMARY KEY,
  category_id        INTEGER REFERENCES public.quik_class_categories (id) ON DELETE SET NULL,
  trade_segment_id   INTEGER REFERENCES public.quik_class_trade_segments (id) ON DELETE SET NULL,
  note               TEXT,
  quik_class_name    VARCHAR(256),
  quik_class_type    INTEGER,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Если таблица уже была создана старой версией скрипта (без trade_segment_id / с VARCHAR(32)):
ALTER TABLE public.quik_class_registry
  ALTER COLUMN class_code TYPE VARCHAR(128);

ALTER TABLE public.quik_class_registry
  ADD COLUMN IF NOT EXISTS trade_segment_id INTEGER REFERENCES public.quik_class_trade_segments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quik_class_registry_category
  ON public.quik_class_registry (category_id);

CREATE INDEX IF NOT EXISTS idx_quik_class_registry_trade_segment
  ON public.quik_class_registry (trade_segment_id);
