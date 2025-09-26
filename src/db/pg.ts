import { Pool } from 'pg';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger(process.env.LOG_LEVEL);

let pool: Pool | null = null;

/**
 * Создаём singleton-пул подключений к Postgres.
 * Параметры подобраны под dev; позже можно тюнить.
 */
export function getPg() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,                  // максимум подключений в пуле
      idleTimeoutMillis: 30_000 // сколько держать неиспользуемое соединение
    });

    pool.on('error', (err) => {
      log.error({ err }, 'Postgres pool error');
    });
  }
  return pool;
}

/** Простой self-check: SELECT 1 */
export async function checkPg() {
  const pg = getPg();
  const res = await pg.query('SELECT 1 AS ok;');
  return res.rows[0]?.ok === 1;
}

/** Грациозное закрытие пула (для SIGINT/SIGTERM) */
export async function closePg() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
