-- 030: Ежедневные опросы
-- poll_date: ЛОКАЛЬНАЯ дата пользователя (как бизнес-ключ) — используем DATE.
CREATE TABLE IF NOT EXISTS daily_polls (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poll_date   DATE NOT NULL,                      -- YYYY-MM-DD локальной даты (тип DATE)
  attempt     SMALLINT NOT NULL DEFAULT 1 CHECK (attempt >= 1 AND attempt <= 3),
  status      TEXT NOT NULL CHECK (status IN ('pending','answered','skipped')),
  answer      TEXT NULL CHECK (answer IN ('yes','no') OR answer IS NULL),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Идемпотентность "опрос на пользователя в дату"
ALTER TABLE daily_polls
  ADD CONSTRAINT uq_daily_polls_user_date UNIQUE (user_id, poll_date);

CREATE INDEX IF NOT EXISTS idx_daily_polls_user_date ON daily_polls(user_id, poll_date);
