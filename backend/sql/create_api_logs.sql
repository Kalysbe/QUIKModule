-- Таблица для централизованного логирования всех HTTP-запросов API
-- Скрипт можно выполнить один раз при развёртывании или включить в систему миграций

CREATE TABLE IF NOT EXISTS api_logs (
  id               BIGSERIAL PRIMARY KEY,
  request_id       UUID        NOT NULL,
  "timestamp"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method           VARCHAR(16),
  url              TEXT,
  route            TEXT,
  query_params     JSONB,
  request_body     JSONB,
  headers          JSONB,
  ip_address       INET,
  user_agent       TEXT,
  user_id          TEXT,
  role             TEXT,
  status_code      INTEGER,
  response_body    JSONB,
  response_message TEXT,
  response_time_ms INTEGER,
  error_message    TEXT,
  error_stack      TEXT,
  error_type       TEXT,
  truncated        BOOLEAN     NOT NULL DEFAULT FALSE,
  level            VARCHAR(10)
);

-- Основные индексы для типичных сценариев выборки

CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp
  ON api_logs ("timestamp");

CREATE INDEX IF NOT EXISTS idx_api_logs_status_code
  ON api_logs (status_code);

CREATE INDEX IF NOT EXISTS idx_api_logs_user_id
  ON api_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_api_logs_method
  ON api_logs (method);

CREATE INDEX IF NOT EXISTS idx_api_logs_url
  ON api_logs (url);

