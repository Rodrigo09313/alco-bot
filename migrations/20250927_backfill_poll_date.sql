-- Русский коммент: на всякий случай проставим poll_date для старых строк
UPDATE daily_polls
SET poll_date = (created_at AT TIME ZONE 'Europe/Moscow')::date
WHERE poll_date IS NULL;
