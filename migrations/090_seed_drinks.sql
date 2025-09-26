-- 090: начальные значения для drinks (идемпотентно)
INSERT INTO drinks(code, name, default_abv)
VALUES
  ('beer',     'Пиво',        5.0),
  ('wine',     'Вино',        12.0),
  ('spirit',   'Крепкий',     40.0),
  ('cocktail', 'Коктейль',    12.0),
  ('other',    'Другое',      NULL)
ON CONFLICT (code) DO NOTHING;
