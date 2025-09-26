-- 020: Справочник напитков
CREATE TABLE IF NOT EXISTS drinks (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL, -- 'beer'|'wine'|'spirit'|'cocktail'|'other'
  name         TEXT NOT NULL,
  default_abv  NUMERIC(5,2) NULL     -- средняя крепость, %
);
