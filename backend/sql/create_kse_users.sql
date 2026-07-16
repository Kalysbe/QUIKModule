-- Таблица пользователей KSE (база quik_kse)
-- Поля: login, имя, фамилия, код фирмы, role (admin/operator/minfin), password_hash, last_activity_at

CREATE TABLE IF NOT EXISTS public.kse_users (
  id                SERIAL PRIMARY KEY,
  login             VARCHAR(64) NOT NULL UNIQUE,
  first_name        VARCHAR(255) NOT NULL,
  last_name         VARCHAR(255) NOT NULL,
  firm_code         VARCHAR(64) NOT NULL,
  role              VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'operator', 'minfin')),
  password_hash     VARCHAR(255) NOT NULL,
  last_activity_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kse_users_login ON public.kse_users (login);
CREATE INDEX IF NOT EXISTS idx_kse_users_last_activity_at ON public.kse_users (last_activity_at);

COMMENT ON TABLE public.kse_users IS 'Пользователи API KSE (авторизация JWT)';
