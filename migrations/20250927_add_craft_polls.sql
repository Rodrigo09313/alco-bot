-- Крафтовые опросы: тип и текст вопроса
ALTER TABLE daily_polls
  ADD COLUMN IF NOT EXISTS kind     text NOT NULL DEFAULT 'daily' CHECK (kind IN ('daily','craft')),
  ADD COLUMN IF NOT EXISTS question text;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_daily_polls_kind_created_at
  ON daily_polls(kind, created_at DESC);
