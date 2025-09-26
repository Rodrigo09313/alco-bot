// Надёжный старт polling: сбрасываем webhook, запускаем polling с таймаутом,
// логируем шаги, не даём main() висеть на первом long-poll,
// и умеем автоперезапускаться при сетевых ошибках (EAI_AGAIN и т.п.).

import TelegramBot from 'node-telegram-bot-api';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { registerHandlers } from './handlers.js';

const log = createLogger(process.env.LOG_LEVEL);
let bot: TelegramBot | null = null;
let restarting = false;
let backoffMs = 2000; // старт бэк-оффа 2с, максимум 30с

// Промис с таймаутом
function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout in ${tag} after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

export async function startBot() {
  log.debug('BOT: creating instance (polling autoStart:false)');
  bot = new TelegramBot(env.BOT_TOKEN, {
    polling: {
      autoStart: false,
      interval: 250,            // задержка между запросами
      params: { timeout: 10 }   // короткий long-poll, чтобы не висеть
    }
  });

  // Регистрируем обработчики команд/кнопок/сообщений
  registerHandlers(bot);

  // Ошибки polling/webhook
  bot.on('polling_error', async (err: any) => {
    log.error({ err }, 'polling_error');
    const msg = String(err?.message ?? err);
    // Сетевые/ДНС ошибки — мягкий рестарт polling с экспоненциальным бэкоффом
    if (/(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up)/i.test(msg)) {
      if (restarting) return;
      restarting = true;
      try { await bot!.stopPolling({ cancel: true, reason: 'net_error' }); } catch {}
      setTimeout(async () => {
        try {
          await bot!.startPolling();
          log.warn({ backoffMs }, 'polling restarted after net error');
        } catch (e) {
          log.error({ e }, 'polling restart failed');
        } finally {
          restarting = false;
          backoffMs = Math.min(backoffMs * 2, 30000); // до 30с
        }
      }, backoffMs);
    }
  });

  bot.on('webhook_error',  (err) => log.error({ err }, 'webhook_error'));

  // 1) Сброс вебхука
  try {
    log.debug('BOT: deleteWebHook:start');
    await withTimeout(bot.deleteWebHook({ drop_pending_updates: false }), 3000, 'deleteWebHook');
    log.debug('BOT: deleteWebHook:done');
  } catch (err) {
    log.warn({ err }, 'BOT: deleteWebHook:fail (continue)');
  }

  // 2) Старт polling — не даём висеть: если >3с, логируем и едем дальше
  log.debug('BOT: startPolling()');
  try {
    await withTimeout(bot.startPolling(), 3000, 'startPolling');
  } catch (err) {
    log.warn({ err }, 'BOT: startPolling is slow; continuing anyway');
  }
  log.info('Bot started');

  // 3) Диагностика whoami (не критично)
  try {
    const me = await withTimeout(bot.getMe(), 3000, 'getMe');
    log.debug({ id: me.id, username: me.username }, 'BOT: getMe');
  } catch (err) {
    log.warn({ err }, 'BOT: getMe failed (non-fatal)');
  }

  // 4) Простая обработка сообщений — smoke
  bot.on('message', (msg) => {
    log.debug({ from: msg.from?.id, text: msg.text }, 'Incoming message');
  });
}

export async function stopBot() {
  if (bot) {
    try {
      await bot.stopPolling({ cancel: true, reason: 'shutdown' });
    } catch { /* ignore */ }
    bot = null;
  }
}
