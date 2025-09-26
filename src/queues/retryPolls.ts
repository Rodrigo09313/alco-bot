// Очередь ретраев опросов: ставим задачи на напоминания, если статус ещё pending.
// Правила (из ТЗ): retry1 = now + 2h (но не позже 22:00 лок.), retry2 = завтра 09:00 лок.

import { Queue, Worker, JobsOptions, QueueEvents } from 'bullmq';
import { createLogger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { URL } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import { getByTelegramId } from '../db/usersRepo.js';
import { getPoll, bumpAttempt } from '../db/pollRepo.js';
import { localDateYYYYMMDD, localHour, makeZonedDate } from '../lib/time.js';
import { showScreen } from '../ui/screen.js';

const log = createLogger(process.env.LOG_LEVEL);

// Разбираем REDIS_URL для BullMQ (она принимает опции подключения)
function redisConnection() {
  const u = new URL(env.REDIS_URL);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined
  };
}

export interface RetryJobData {
  user_id: number;
  chat_id: number;
  // локальная бизнес-дата опроса
  poll_date: string; // YYYY-MM-DD
  attempt: number;   // 1 -> ставим retry1; 2 -> retry2
}

/** Создать очередь и воркер. Передаём ссылку на бот, чтобы отправлять SLM из обработчика */
export function createRetryQueue(bot: TelegramBot) {
  const queue = new Queue<RetryJobData>('retry-polls', { connection: redisConnection() });
  const events = new QueueEvents('retry-polls', { connection: redisConnection() });
  events.on('failed', ({ jobId, failedReason }) => log.warn({ jobId, failedReason }, 'retry job failed'));
  events.on('completed', ({ jobId }) => log.debug({ jobId }, 'retry job done'));

  const worker = new Worker<RetryJobData>(
    'retry-polls',
    async (job) => {
      const { user_id, chat_id, poll_date, attempt } = job.data;

      // Если всё ещё pending и попыток <3 — показываем напоминание и увеличиваем attempt
      const poll = await getPoll(user_id, poll_date);
      if (!poll) return;
      if (poll.status !== 'pending') return; // уже ответил/скипнул

      if (poll.attempt >= 3) return; // лимит попыток

      await bumpAttempt(user_id, poll_date);
      await showScreen(bot, chat_id, `<b>Напоминание</b>\n\nСегодня пил?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Нет, я молодец! ✅', callback_data: 'poll:no' }],
            [{ text: 'Да, было дело! 🍷', callback_data: 'poll:yes' }],
          ]
        }
      });
    },
    { connection: redisConnection(), concurrency: 5 }
  );

  return { queue, worker, events };
}

/** Планирование двух ретраев для только что показанного опроса */
export async function scheduleRetries(queue: Queue<RetryJobData>, data: { user_id: number; chat_id: number; }) {
  const tz = env.DEFAULT_TZ;
  const today = localDateYYYYMMDD(tz);
  const now = new Date();

  // retry1: now + 2h, но не позже 22:00 лок.
  const h = localHour(tz, now);
  const targetHour1 = Math.min(h + 2, 22);
  const runAt1 = makeZonedDate(tz, today, targetHour1);
  const delay1 = Math.max(0, runAt1.getTime() - Date.now());

  // retry2: на следующий день 09:00 лок.
  const parts = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(parts[0], parts[1]-1, parts[2] + 1));
  const ymdTomorrow = localDateYYYYMMDD(tz, tomorrow);
  const runAt2 = makeZonedDate(tz, ymdTomorrow, 9);
  const delay2 = Math.max(0, runAt2.getTime() - Date.now());

  const opts: JobsOptions = { removeOnComplete: true, removeOnFail: true };

  await queue.add('retry1', {
    user_id: data.user_id,
    chat_id: data.chat_id,
    poll_date: today,
    attempt: 1
  }, { ...opts, delay: delay1 });

  await queue.add('retry2', {
    user_id: data.user_id,
    chat_id: data.chat_id,
    poll_date: today,
    attempt: 2
  }, { ...opts, delay: delay2 });
}
