// src/index.ts
// Точка входа приложения.
// 1) Проверяем Postgres/Redis.
// 2) Стартуем бота, регистрируем роутеры.
// 3) Включаем планировщик опросов по МСК.
// 4) Аккуратное завершение по сигналам.

import { createLogger } from './lib/logger';
import { getPg, checkPg, closePg } from './db/pg';
import { getRedis, checkRedis, closeRedis } from './lib/redis';
import { startBot, stopBot } from './bot/bootstrap';
import { registerHandlers } from './bot/handlers';
import { registerPollFlow } from './bot/pollFlow';
import { startScheduler } from './bot/scheduler';

const log = createLogger(process.env.LOG_LEVEL || 'info');

async function main() {
  // Логируем окружение (без зависимостей от env.ts)
  log.info({ NODE_ENV: process.env.NODE_ENV || 'unknown' }, 'Starting app');

  // --- Healthchecks: Postgres ---
  try {
    getPg();         // инициализируем пул (соединение ленивое)
    await checkPg(); // простой SELECT 1; бросит ошибку, если нет соединения
    log.info('Postgres: OK');
  } catch (err) {
    log.error({ err }, 'Postgres: FAIL');
    process.exit(1);
  }

  // --- Healthchecks: Redis ---
  try {
    const r = getRedis();
    await checkRedis(r); // ping/pong
    log.info('Redis: OK');
  } catch (err) {
    log.error({ err }, 'Redis: FAIL');
    process.exit(1);
  }

  // --- Бот + обработчики ---
  const bot = await startBot();   // внутри: снимаем webhook, стартуем polling с таймаутом
  registerHandlers(bot);          // единый роутер команд/кнопок/навигации
  registerPollFlow(bot);          // флоу «Сегодня пил?»
  log.info('Bot: started, handlers & poll flow registered');

  // --- Планировщик опросов по московскому времени ---
  const stopScheduler = startScheduler(bot); // вернёт функцию остановки таймера
  log.info('Scheduler: enabled (Europe/Moscow)');

  // --- Корректное завершение ---
  const shutdown = async (reason: string) => {
    log.warn({ reason }, 'Shutting down...');
    try { stopScheduler?.(); } catch {}
    try { await stopBot(); } catch {}
    try { await closePg(); } catch {}
    try { await closeRedis(); } catch {}
    log.info('Bye');
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Глобальный перехват фатальных ошибок
main().catch((err) => {
  log.error({ err }, 'Fatal in main()');
  process.exit(1);
});
