/**
 * Smoke-тест репозиториев без Telegram:
 * 1) createOrGet(user 999001)
 * 2) createPending на локальную дату
 * 3) setPollAnswered('no') -> applyAnswer('no')
 * 4) Вывести streaks и наличие poll'а
 */
import 'dotenv/config';
import { createOrGet, getByTelegramId } from '../src/db/usersRepo.js';
import { createLogger } from '../src/lib/logger.js';
import { localDateYYYYMMDD } from '../src/lib/localDate.js';
import { createPending, getPoll, setPollAnswered } from '../src/db/pollRepo.js';
import { applyAnswer } from '../src/db/streakRepo.js';
import { env } from '../src/config/env.js';
import { closePg } from '../src/db/pg.js';
import { closeRedis } from '../src/lib/redis.js';

const log = createLogger(process.env.LOG_LEVEL);

async function main() {
  const tgId = 999001; // тестовый ID
  const tz = env.DEFAULT_TZ; // возьмём дефолт из ENV
  const dateISO = localDateYYYYMMDD(tz);

  log.info({ tgId, tz, dateISO }, 'SMOKE start');

  const user = await createOrGet(tgId);
  log.info({ userId: user.id }, 'user ready');

  const poll = await createPending(user.id, dateISO);
  log.info({ pollId: poll.id, attempt: poll.attempt, status: poll.status }, 'poll pending created');

  const answered = await setPollAnswered(user.id, dateISO, 'no');
  log.info({ pollId: answered?.id, answer: answered?.answer, status: answered?.status }, 'poll answered');

  const streaks = await applyAnswer(user.id, 'no');
  log.info({ streaks }, 'streaks updated');

  const finalPoll = await getPoll(user.id, dateISO);
  log.info({ finalPoll }, 'final poll fetch');

  log.info('SMOKE ok');
}

main().catch((err) => {
  log.error({ err }, 'SMOKE fail');
  process.exit(1);
}).finally(async () => {
  await closeRedis();
  await closePg();
});
