-- 060: Реакции бота и история отправок

CREATE TABLE IF NOT EXISTS bot_reactions (
  id              BIGSERIAL PRIMARY KEY,
  trigger         TEXT NOT NULL,        -- например: 'poll_no_praise','poll_yes_soft','streak_up','streak_broken',...
  mode            TEXT NULL CHECK (mode IN ('zozh','alco') OR mode IS NULL),
  locale          TEXT NULL,            -- 'ru-RU' | 'ru' | NULL
  text_template   TEXT NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('none','sticker','photo','animation','audio')),
  media_id        TEXT NULL,            -- Telegram file_id
  min_streak      INT NULL,
  max_streak      INT NULL,
  min_drinks      INT NULL,
  max_drinks      INT NULL,
  dow_mask        INT NULL,             -- битовая маска дней недели (по желанию)
  hour_start      SMALLINT NULL CHECK (hour_start IS NULL OR (hour_start >= 0 AND hour_start <= 23)),
  hour_end        SMALLINT NULL CHECK (hour_end IS NULL OR (hour_end >= 0 AND hour_end <= 23)),
  weight          INT NOT NULL DEFAULT 1 CHECK (weight >= 0),
  cooldown_days   INT NOT NULL DEFAULT 14 CHECK (cooldown_days >= 0),
  is_active       BOOL NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_reaction_history (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_id BIGINT NOT NULL REFERENCES bot_reactions(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, reaction_id, sent_at)
);

-- Индекс по времени (на отбор последних реакций)
CREATE INDEX IF NOT EXISTS idx_user_rx_history_user_time ON user_reaction_history(user_id, sent_at DESC);
