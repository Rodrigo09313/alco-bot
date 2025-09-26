-- 095: простые реакции (минимальный набор)
INSERT INTO bot_reactions
(trigger, mode, locale, text_template, media_type, weight, cooldown_days, is_active)
VALUES
  ('poll_no_praise', 'zozh', 'ru', 'Красавчик! День без алкоголя засчитан. Текущая серия: {streak}', 'none', 3, 7, TRUE),
  ('poll_yes_soft',  'alco', 'ru', 'Окей, фиксирую. Важно не переборщить. Завтра сделаем паузу?', 'none', 2, 7, TRUE),
  ('streak_up',      NULL,   'ru', 'Серия растёт: уже {streak} дней подряд!', 'none', 1, 3, TRUE)
ON CONFLICT DO NOTHING;
