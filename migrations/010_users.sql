-- 010: Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  login           TEXT NULL,
  mode            TEXT NULL CHECK (mode IN ('zozh','alco') OR mode IS NULL),
  poll_hour       INT NOT NULL DEFAULT 20 CHECK (poll_hour >= 0 AND poll_hour <= 23),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
