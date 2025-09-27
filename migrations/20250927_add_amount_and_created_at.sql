-- Дополняем consumption_records недостающими полями/связями

-- 1) Колонки
ALTER TABLE consumption_records
  ADD COLUMN IF NOT EXISTS amount       integer     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS drink_code   text,
  ADD COLUMN IF NOT EXISTS poll_id      integer;

-- 2) FK на drinks(code) — если есть справочник
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='drinks')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_name='consumption_records'
         AND constraint_type='FOREIGN KEY'
         AND constraint_name='consumption_records_drink_code_fkey'
     )
  THEN
    ALTER TABLE consumption_records
      ADD CONSTRAINT consumption_records_drink_code_fkey
      FOREIGN KEY (drink_code) REFERENCES drinks(code)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- 3) FK на daily_polls(id) для связи с опросом
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='daily_polls')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_name='consumption_records'
         AND constraint_type='FOREIGN KEY'
         AND constraint_name='consumption_records_poll_id_fkey'
     )
  THEN
    ALTER TABLE consumption_records
      ADD CONSTRAINT consumption_records_poll_id_fkey
      FOREIGN KEY (poll_id) REFERENCES daily_polls(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Индексы
CREATE INDEX IF NOT EXISTS idx_consumption_user_created_at
  ON consumption_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumption_poll
  ON consumption_records (poll_id);
