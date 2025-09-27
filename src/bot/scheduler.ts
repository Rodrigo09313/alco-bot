// Планировщик часовых опросов по московскому времени.
// - Каждые ~30с проверяем "наступил ли новый час в МСК".
// - Отправляем опрос тем, у кого poll_hour == текущий час (МСК).
// - Redis-замок через строковые флаги: SET key '1' EX ttl NX.

import TelegramBot from 'node-telegram-bot-api';
import { getRedis } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';
import { listUsersByPollHour, listAllUsers, type UserRow } from '../db/usersRepo.js';
import { createManualPoll } from '../db/pollRepo.js';
import { todayPollText, todayPollKeyboard } from '../ui/text.js';
import { showScreen } from '../ui/screen.js';

const log = createLogger(process.env.LOG_LEVEL);
const r = getRedis();

function nowMoscow(): Date {
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
  return new Date(iso);
}
function mskHour(d = nowMoscow()): number { return d.getHours(); }
function mskKeyForHour(d = nowMoscow()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  return `poll:hourlock:${y}${m}${day}${h}`;
}

async function tryLockHour(key: string, ttlSec = 3600): Promise<boolean> {
  // ВАЖНО: строковые флаги (совместимо и с ioredis, и с node-redis v3/v4):
  // SET key '1' EX ttl NX
  const res = await (r as any).set(key, '1', 'EX', ttlSec, 'NX');
  return res === 'OK';
}

async function sendPollToUser(bot: TelegramBot, u: Pick<UserRow,'id'|'telegram_id'>) {
  await createManualPoll(u.id);
  await showScreen(bot, u.telegram_id, todayPollText(), { reply_markup: todayPollKeyboard() });
}

export async function pollUsers(bot: TelegramBot, users: Pick<UserRow,'id'|'telegram_id'>[]) {
  let ok = 0, fail = 0;
  for (const u of users) {
    try {
      await sendPollToUser(bot, u);
      ok++;
    } catch (err) {
      fail++;
      log.error({ err, userId: u.id }, 'scheduler: sendPollToUser failed');
    }
  }
  return { ok, fail, total: users.length };
}

export async function pollUsersByHour(bot: TelegramBot, hourMsk: number) {
  const users = await listUsersByPollHour(hourMsk);
  return pollUsers(bot, users);
}

export async function pollAll(bot: TelegramBot) {
  const users = await listAllUsers();
  return pollUsers(bot, users);
}

export function startScheduler(bot: TelegramBot) {
  log.info('Scheduler: start (MSK hourly checks)');
  let lastHour = -1;

  const tick = async () => {
    try {
      const now = nowMoscow();
      const hh = now.getHours();
      const mm = now.getMinutes();

      if (hh !== lastHour && mm <= 1) {
        const key = mskKeyForHour(now);
        if (await tryLockHour(key, 4000)) {
          lastHour = hh;
          log.info({ mskHour: hh }, 'Scheduler: firing hourly wave');
          const res = await pollUsersByHour(bot, hh);
          log.info({ ...res, mskHour: hh }, 'Scheduler: wave done');
        } else {
          lastHour = hh; // кто-то уже запустил
        }
      }
    } catch (err) {
      log.error({ err }, 'Scheduler tick error');
    }
  };

  tick().catch(()=>{});
  const timer = setInterval(tick, 30_000);
  return () => clearInterval(timer);
}
