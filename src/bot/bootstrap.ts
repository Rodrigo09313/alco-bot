// Надёжный старт polling: сбрасываем webhook, запускаем polling с таймаутом,
// НЕ регистрируем хендлеры здесь (чтобы не было дублей) — только в index.ts.

import TelegramBot from 'node-telegram-bot-api';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger(process.env.LOG_LEVEL || 'info');

let bot: TelegramBot | null = null;
let restarting = false;
let backoffMs = 2000; // экспоненциальный бэкофф до 30с

// Промис с таймаутом
function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout in ${tag} after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); },
           (e) => { clearTimeout(t); reject(e); });
  });
}

export async function startBot(): Promise<TelegramBot> {
  if (bot) {
    log.debug('BOT: already started, reuse instance');
    return bot;
  }

  // 0) Создаём инстанс без автозапуска
  log.debug('BOT: creating instance (polling autoStart:false)');
  bot = new TelegramBot(env.BOT_TOKEN, {
    polling: { autoStart: false, interval: 250, params: { timeout: 10 } },
  });

  // 1) Ошибки polling/webhook + авто-рестарт при сетевых
  bot.on('polling_error', async (err: any) => {
    log.error({ err }, 'polling_error');
    const msg = String(err?.message ?? err);
    if (/(EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up)/i.test(msg)) {
      if (restarting) return;
      restarting = true;
      try { await bot!.stopPolling(); } catch {}          // ❗ без аргументов
      setTimeout(async () => {
        try { await bot!.startPolling(); log.warn({ backoffMs }, 'polling restarted'); }
        catch (e) { log.error({ e }, 'polling restart failed'); }
        finally { restarting = false; backoffMs = Math.min(backoffMs * 2, 30000); }
      }, backoffMs);
    }
  });
  bot.on('webhook_error', (err) => log.error({ err }, 'webhook_error'));

  // 2) Сбрасываем webhook и очищаем очередь апдейтов
  try {
    log.debug('BOT: deleteWebHook:start');
    await withTimeout(bot.deleteWebHook({ drop_pending_updates: true }), 5000, 'deleteWebHook');
    log.debug('BOT: deleteWebHook:done');
  } catch (err) {
    log.warn({ err }, 'BOT: deleteWebHook:fail (continue)');
  }

  // 3) Стартуем polling (даём до 15с; при таймауте — только warn)
  log.debug('BOT: startPolling()');
  try {
    await withTimeout(bot.startPolling(), 15000, 'startPolling');
  } catch (err) {
    log.warn({ err }, 'BOT: startPolling is slow; continuing anyway');
  }
  log.info('Bot started');

  // 4) Диагностика whoami (не критично)
  try {
    const me = await withTimeout(bot.getMe(), 5000, 'getMe');
    log.debug('BOT: getMe %j', { id: me.id, username: me.username });
  } catch (err) {
    log.warn({ err }, 'BOT: getMe failed (non-fatal)');
  }

  // 5) Лёгкий smoke-лог входящих (можно убрать)
  bot.on('message', (msg) => {
    log.debug({ from: msg.from?.id, text: msg.text }, 'Incoming message');
  });

  return bot;
}

export async function stopBot() {
  if (!bot) return;
  try { await bot.stopPolling(); } catch {}               // ❗ без аргументов
  bot = null;
}
