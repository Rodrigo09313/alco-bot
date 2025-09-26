// Диспетчер: каждую минуту обходит пользователей и, если локальный час == poll_hour,
// а на сегодня нет answered — создаёт pending и показывает SLM "Сегодня пил?",
// после чего планирует два ретрая в BullMQ.

import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { q } from '../db/sql.js';
import { localDateYYYYMMDD, localHour } from '../lib/time.js';
import { createPending, getPoll } from '../db/pollRepo.js';
import { showScreen } from '../ui/screen.js';
import { createRetryQueue, scheduleRetries } from '../queues/retryPolls.js';

const log = createLogger(process.env.LOG_LEVEL);

export function startScheduler(bot: TelegramBot) {
  const tz = env.DEFAULT_TZ;
  const { queue } = createRetryQueue(bot);

  async function tick() {
    try {
      const hour = localHour(tz);
      const today = localDateYYYYMMDD(tz);

      // Берём всех пользователей, у кого poll_hour == текущему локальному часу
      const users = await q<{ id: number; poll_hour: number; telegram_id: number }>(
        `SELECT id, poll_hour, telegram_id FROM users WHERE poll_hour = $1`,
        [hour]
      );

      for (const u of users) {
        // Проверим, есть ли на сегодня ответ
        const p = await getPoll(u.id, today);
        if (p && p.status === 'answered') continue;

        // Создаём/обновляем pending
        await createPending(u.id, today);

        // Показываем опрос
        await showScreen(bot, u.telegram_id, `<b>Сегодня пил? 🍻</b>`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Нет, я молодец! ✅', callback_data: 'poll:no' }],
              [{ text: 'Да, было дело! 🍷', callback_data: 'poll:yes' }],
            ],
          },
        });

        // Планируем ретраи
        await scheduleRetries(queue, { user_id: u.id, chat_id: u.telegram_id });
      }
    } catch (err) {
      log.error({ err }, 'scheduler tick error');
    }
  }

  // Первый запуск «по ровной минуте», затем раз в 60 секунд
  const now = new Date();
  const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  setTimeout(() => {
    tick();
    setInterval(tick, 60_000);
  }, msToNextMinute);

  log.info('Scheduler started (tick every minute)');
}
