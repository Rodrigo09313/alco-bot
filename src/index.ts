import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { getPg, checkPg, closePg } from './db/pg.js';
import { getRedis, checkRedis, closeRedis } from './lib/redis.js';
import { startBot, stopBot } from './bot/bootstrap.js';

const log = createLogger(env.LOG_LEVEL);

/**
 * main(): пошагово проверяем окружение, коннекты и запускаем «пустой» бот.
 * Всё с русскими логами, чтобы быстро диагностировать проблемы новичку.
 */
async function main() {
  log.info({ NODE_ENV: process.env.NODE_ENV ?? 'dev' }, 'Starting app');

  // 1) Подключение к Postgres
  try {
    getPg();
    const ok = await checkPg();
    if (!ok) throw new Error('SELECT 1 вернул не 1');
    log.info('Postgres: OK');
  } catch (err) {
    log.error({ err }, 'Postgres: FAIL');
    process.exit(1);
  }

  // 2) Подключение к Redis
  try {
    getRedis();
    const ok = await checkRedis();
    if (!ok) throw new Error('PING != PONG');
    log.info('Redis: OK');
  } catch (err) {
    log.error({ err }, 'Redis: FAIL');
    process.exit(1);
  }

  // 3) Стартуем бота (polling)
  try {
    await startBot();
  } catch (err) {
    log.error({ err }, 'Bot start: FAIL (проверь BOT_TOKEN)');
    process.exit(1);
  }

  // Грациозное выключение
  const shutdown = async (reason: string) => {
    log.warn({ reason }, 'Shutting down...');
    await stopBot();
    await closeRedis();
    await closePg();
    log.info('Bye');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // Непойманные ошибки
  const log = createLogger(process.env.LOG_LEVEL);
  log.fatal({ err }, 'Fatal error');
  process.exit(1);
});
