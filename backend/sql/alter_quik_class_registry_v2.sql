-- Доработка реестра классов (уже развёрнутый quik_kse): длина кода, сегмент торгов
-- Выполнить: psql ... -d quik_kse -f sql/alter_quik_class_registry_v2.sql

-- Длинные коды классов в некоторых выгрузках QUIK
ALTER TABLE public.quik_class_registry
  ALTER COLUMN class_code TYPE VARCHAR(128);

CREATE TABLE IF NOT EXISTS public.quik_class_trade_segments (
  id       SERIAL PRIMARY KEY,
  code     VARCHAR(32) NOT NULL UNIQUE,
  name_ru  VARCHAR(100) NOT NULL
);

INSERT INTO public.quik_class_trade_segments (code, name_ru) VALUES
  ('auction', 'Аукцион'),
  ('secondary', 'Вторичка')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.quik_class_registry
  ADD COLUMN IF NOT EXISTS trade_segment_id INTEGER REFERENCES public.quik_class_trade_segments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quik_class_registry_trade_segment
  ON public.quik_class_registry (trade_segment_id);
