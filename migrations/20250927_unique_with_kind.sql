-- Русский коммент: раньше было уникально по (user_id, poll_date).
-- Теперь разрешаем по одному daily и по одному craft в день.
ALTER TABLE daily_polls
  DROP CONSTRAINT IF EXISTS uq_daily_polls_user_date;

ALTER TABLE daily_polls
  ADD CONSTRAINT uq_daily_polls_user_date_kind
  UNIQUE (user_id, poll_date, kind);
