-- 040: Записи потребления
CREATE TABLE IF NOT EXISTS consumption_records (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date        DATE NOT NULL,                               -- локальная дата
  drink_code        TEXT NOT NULL REFERENCES drinks(code) ON UPDATE CASCADE,
  drinks_count      NUMERIC(6,2) NOT NULL CHECK (drinks_count >= 0),
  ml                INT NULL CHECK (ml IS NULL OR ml >= 0),
  pure_alcohol_ml   INT NULL CHECK (pure_alcohol_ml IS NULL OR pure_alcohol_ml >= 0),
  cost              INT NULL CHECK (cost IS NULL OR cost >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumption_user_date ON consumption_records(user_id, local_date);
