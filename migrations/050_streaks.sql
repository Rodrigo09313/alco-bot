-- 050: Серии (трезвые/пьяные)
CREATE TABLE IF NOT EXISTS streaks (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sober_current INT NOT NULL DEFAULT 0 CHECK (sober_current >= 0),
  sober_best    INT NOT NULL DEFAULT 0 CHECK (sober_best >= 0),
  drunk_current INT NOT NULL DEFAULT 0 CHECK (drunk_current >= 0),
  drunk_best    INT NOT NULL DEFAULT 0 CHECK (drunk_best >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
