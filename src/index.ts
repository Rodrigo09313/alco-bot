// Точка входа приложения (без nav.ts).
// Делаем healthcheck Postgres/Redis, запускаем бота, регистрируем единый роутер и опрос.

import { createLogger } from './lib/logger';
import { getPg, checkPg, closePg } from './db/pg';
import { getRedis, checkRedis, closeRedis } from './lib/redis';
import { startBot, stopBot } from './bot/bootstrap';
import { registerHandlers } from './bot/handlers';
import { registerPollFlow } from './bot/pollFlow';

const log = createLogger(process.env.LOG_LEVEL || 'info');

async function main() {
  // Логируем NODE_ENV напрямую из process.env (а не из env)
  log.info({ NODE_ENV: process.env.NODE_ENV || 'unknown' }, 'Starting app');

  // --- Healthchecks БД (тип возвращаемого значения — void, просто ждём успех) ---
  try {
    getPg();             // инициализация пула
    await checkPg();     // проверочный запрос SELECT 1; кинет ошибку при проблеме
    log.info('Postgres: OK');
  } catch (err) {
    log.error({ err }, 'Postgres: FAIL');
    process.exit(1);
  }

  // --- Healthchecks Redis (также void) ---
  try {
    const r = getRedis();
    await checkRedis(r);
    log.info('Redis: OK');
  } catch (err) {
    log.error({ err }, 'Redis: FAIL');
    process.exit(1);
  }

  // --- Бот + обработчики ---
  const bot = await startBot();   // снимаем вебхук, запускаем polling внутри bootstrap
  registerHandlers(bot);          // ЕДИНЫЙ роутер команд/кнопок
  registerPollFlow(bot);          // Флоу "Сегодня пил?"
  log.info('Bot: started, handlers & poll flow registered');

  // --- Корректное завершение ---
  const shutdown = async (reason: string) => {
    log.warn({ reason }, 'Shutting down...');
    try { await stopBot(); } catch {}
    try { await closePg(); } catch {}
    try { await closeRedis(); } catch {}
    log.info('Bye');
    process.exit(0);
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'Fatal in main()');
  process.exit(1);
});
