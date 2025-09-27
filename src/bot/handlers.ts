// ЕДИНЫЙ роутер: меню/профиль/лидеры/настройки + АДМИН-ПАНЕЛЬ.
// Весь текст и клавиатуры вынесены в src/ui/text.ts.

import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from '../lib/logger.js';
import {
  createOrGet, updateLogin, getByTelegramId,
  updateMode, updatePollHour, listAllUsers
} from '../db/usersRepo.js';
import { getSession, setState, clearSession } from '../fsm/session.js';
import { showScreen, editOrReplaceFromCallback } from '../ui/screen.js';
import {
  // Меню
  mainMenuText, mainMenuKeyboard,
  // Универсальные клавиатуры/тексты
  backOnlyKeyboard, backToProfileKeyboard, toMenuKeyboard,
  needStartText, emptyTextError,
  // Онбординг
  askLoginText, chooseModeText, chooseModeKeyboard,
  // Настройки
  settingsRootText, settingsRootKeyboard,
  settingsModeText, settingsModeKeyboard,
  settingsTimeText, settingsTimeKeyboard,
  // Профиль
  profileSummaryText, profileKeyboard,
  // Опросы
  todayPollText, todayPollKeyboard,
  // Лидеры
  leaderboardText, leaderboardKeyboard,
  // Админ
  adminText, adminKeyboard, craftPromptText,
  craftResultText, pollAllResultText, pollHourResultText,
  // Типы
  type Mode,
} from '../ui/text.js';
import { q1 } from '../db/sql.js';
import { pollAll, pollUsersByHour } from './scheduler.js';
import { createCraftPoll } from '../db/pollRepo.js';
import { getLeaderboard } from '../db/leaderboardRepo.js';

const log = createLogger(process.env.LOG_LEVEL);

// Только этот Telegram ID видит /admin
const ADMIN_TG_ID = 7685650143;

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные рендеры профиля/целей
async function renderProfileSummary(user: { id: number; login: string | null; mode: Mode | null; }) {
  const streak = await q1<{ sober_current: number; sober_best: number; drunk_current: number; drunk_best: number; }>`
    SELECT sober_current, sober_best, drunk_current, drunk_best
    FROM streaks WHERE user_id = ${user.id}
  `;
  const totals = await q1<{ no_cnt: number; yes_cnt: number }>`
    SELECT
      COALESCE(SUM((answer='no')::int),0)::int  AS no_cnt,
      COALESCE(SUM((answer='yes')::int),0)::int AS yes_cnt
    FROM daily_polls
    WHERE user_id = ${user.id}
  `;
  const noCnt = totals?.no_cnt ?? 0;
  const yesCnt = totals?.yes_cnt ?? 0;
  const total = noCnt + yesCnt;
  const soberPct = total > 0 ? Math.round((noCnt / total) * 100) : 0;

  return profileSummaryText({
    login: user.login ?? undefined,
    mode: (user.mode ?? 'zozh') as Mode,
    soberCurrent: streak?.sober_current ?? 0,
    soberBest:    streak?.sober_best ?? 0,
    drunkCurrent: streak?.drunk_current ?? 0,
    drunkBest:    streak?.drunk_best ?? 0,
    soberDays: noCnt,
    drunkDays: yesCnt,
    soberPct,
  });
}
function pct(a: number, sum: number): number {
  return sum > 0 ? Math.round((a / sum) * 100) : 0;
}
async function renderGoals(user: { id: number; mode: Mode }) {
  const streak = await q1<{ sober_current: number; sober_best: number; drunk_current: number; drunk_best: number; }>`
    SELECT sober_current, sober_best, drunk_current, drunk_best
    FROM streaks WHERE user_id = ${user.id}
  `;
  const last30 = await q1<{ sober: number; drunk: number }>`
    SELECT COALESCE(SUM((answer='no')::int),0)::int AS sober,
           COALESCE(SUM((answer='yes')::int),0)::int AS drunk
    FROM daily_polls
    WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '30 days'
  `;
  const portions30 = await q1<{ portions: number }>`
    SELECT COALESCE(SUM(amount),0)::int AS portions
    FROM consumption_records
    WHERE user_id = ${user.id} AND created_at >= NOW() - INTERVAL '30 days'
  `;
  const sCur = streak?.sober_current ?? 0, sBest = streak?.sober_best ?? 0;
  const dCur = streak?.drunk_current ?? 0, dBest = streak?.drunk_best ?? 0;
  const l30s = last30?.sober ?? 0, l30d = last30?.drunk ?? 0;
  const sober30pct = pct(l30s, l30s + l30d);
  const portions = portions30?.portions ?? 0;

  const goals: { title: string; done: boolean; hint?: string }[] =
    (user.mode === 'zozh'
      ? [
          { title: 'Серия трезвости 7 дней',       done: sCur >= 7,  hint: `Текущая: ${sCur}` },
          { title: 'Лучшая трезвая серия ≥ 21',    done: sBest >= 21, hint: `Лучшая: ${sBest}` },
          { title: '≥ 80% трезвых за 30 дней',     done: sober30pct >= 80, hint: `${sober30pct}%` },
          { title: '0 порций за 30 дней',          done: portions === 0,   hint: `Порций: ${portions}` },
          { title: 'Без запоев (пьян. серия < 2)', done: dCur < 2,         hint: `Пьян. серия: ${dCur}` },
        ]
      : [
          { title: 'Серия пьянства 3 дня',         done: dCur >= 3,  hint: `Текущая: ${dCur}` },
          { title: 'Лучшая пьяная серия ≥ 7',      done: dBest >= 7, hint: `Лучшая: ${dBest}` },
          { title: '≤ 30% трезвых за 30 дней',     done: sober30pct <= 30, hint: `${sober30pct}%` },
          { title: '≥ 30 порций за 30 дней',       done: portions >= 30,   hint: `Порций: ${portions}` },
          { title: 'Нет трезвых серий ≥ 3',        done: sCur < 3,         hint: `Трезв. серия: ${sCur}` },
        ]);

  const goalsLines = goals
    .map(g => `${g.done ? '✅' : '⭕️'} ${g.title}${g.hint ? `\n   <i>${g.hint}</i>` : ''}`)
    .join('\n');

  return `<b>${user.mode === 'zozh' ? '🎯 Цели ЗОЖ' : '🎯 Цели Алко-режима'}</b>\n\n${goalsLines}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Главный экран
async function showMainMenu(bot: TelegramBot, chatId: number) {
  await showScreen(bot, chatId, mainMenuText(), { reply_markup: mainMenuKeyboard() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Регистрация обработчиков
export function registerHandlers(bot: TelegramBot) {
  // /start
  bot.onText(/^\/start(?:\s+.*)?$/i, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const tgId = msg.from?.id; if (!tgId) return;
      const user = await createOrGet(tgId);

      if (!user.login) {
        await showScreen(bot, chatId, askLoginText());
        await setState(user.id, { state: 'WAITING_LOGIN', payload: {} });
        return;
      }
      if (!user.mode) {
        await showScreen(bot, chatId, chooseModeText(), { reply_markup: chooseModeKeyboard() });
        await setState(user.id, { state: 'WAITING_MODE', payload: {} });
        return;
      }

      await showMainMenu(bot, chatId);
      await clearSession(user.id);
    } catch (err) { log.error({ err }, 'error in /start'); }
  });

  // Ввод логина + перехват крафтового вопроса (только для админа)
  bot.on('message', async (msg) => {
    try {
      if (!msg.from || !msg.text) return;
      if (msg.text.startsWith('/')) return;

      // Админ: прислал текст крафтового опроса
      if (msg.from.id === ADMIN_TG_ID) {
        const me = await getByTelegramId(msg.from.id);
        const session = me ? await getSession(me.id) : null;
        if (session?.state === 'ADMIN_AWAIT_CRAFT') {
          const question = msg.text.trim().slice(0, 256);
          if (!question) {
            await showScreen(bot, msg.chat.id, emptyTextError(), { reply_markup: toMenuKeyboard() });
            return;
          }
          const users = await listAllUsers();
          let ok = 0, fail = 0;
          for (const u of users) {
            try {
              const poll = await createCraftPoll(u.id, question);
              await showScreen(bot, u.telegram_id, todayPollText(question), { reply_markup: todayPollKeyboard(poll.id) });
              ok++;
            } catch (err) {
              fail++; log.error({ err, userId: u.id }, 'craft broadcast failed');
            }
          }
          await setState(me!.id, { state: 'IDLE', payload: {} });

          await showScreen(
            bot, msg.chat.id,
            craftResultText(ok, users.length, fail),
            { reply_markup: toMenuKeyboard() }
          );
          return;
        }
      }

      // Обычный ввод логина
      const tgId = msg.from.id;
      const user = await getByTelegramId(tgId); if (!user) return;

      let session = await getSession(user.id);
      if (!session) { session = { state: 'IDLE', payload: {} } as any; await setState(user.id, session).catch(()=>{}); }

      if (session.state === 'WAITING_LOGIN') {
        const login = msg.text.trim().slice(0, 32) || null;
        await updateLogin(tgId, login);
        await setState(user.id, { state: 'WAITING_MODE', payload: {} });
        await showScreen(bot, msg.chat.id, chooseModeText(), { reply_markup: chooseModeKeyboard() });
      }
    } catch (err) { log.error({ err }, 'message handler'); }
  });

  // Команды
  bot.onText(/^\/menu$/,    async (msg) => { await showMainMenu(bot, msg.chat.id); });
  bot.onText(/^\/profile$/, async (msg) => {
    const tgId = msg.from?.id; if (!tgId) return;
    const user = await getByTelegramId(tgId);
    if (!user) return showScreen(bot, msg.chat.id, needStartText(), { reply_markup: mainMenuKeyboard() });
    const text = await renderProfileSummary(user as any);
    await showScreen(bot, msg.chat.id, text, { reply_markup: profileKeyboard() });
  });

  // /leaderboard — команда
  bot.onText(/^\/leaderboard$/i, async (msg) => {
    const page = 1;
    const { rows, total, pageSize } = await getLeaderboard(page, 10);
    await showScreen(
      bot,
      msg.chat.id,
      leaderboardText({ rows, page, total, pageSize }),
      { reply_markup: leaderboardKeyboard({ page, total, pageSize }) }
    );
  });

  // /admin — только для админа
  bot.onText(/^\/admin$/, async (msg) => {
    if (msg.from?.id !== ADMIN_TG_ID) return;
    log.info({ adminId: msg.from.id }, 'Admin entered /admin');
    await showScreen(bot, msg.chat.id, adminText(), { reply_markup: adminKeyboard() });
  });

  // Callback-и
  bot.on('callback_query', async (cb) => {
    try {
      const data = cb.data ?? '';
      const tgId = cb.from?.id;
      const chatId = cb.message?.chat?.id ?? cb.from?.id;
      if (!tgId || !chatId) { if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{}); return; }

      // Админ-раздел
      if (tgId === ADMIN_TG_ID && data.startsWith('admin:')) {
        if (data === 'admin:back') {
          await editOrReplaceFromCallback(bot, cb, mainMenuText(), mainMenuKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        if (data === 'admin:poll_all') {
          const res = await pollAll(bot);
          await editOrReplaceFromCallback(
            bot, cb,
            pollAllResultText(res.ok, res.total, res.fail),
            toMenuKeyboard()
          );
          if (cb.id) await bot.answerCallbackQuery(cb.id, { text: 'Отправил всем' }).catch(()=>{});
          return;
        }
        if (data === 'admin:poll_hour') {
          const hourStr = (new Date()).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false });
          const hour = Number(hourStr);
          const res = await pollUsersByHour(bot, hour);
          await editOrReplaceFromCallback(
            bot, cb,
            pollHourResultText(hour, res.ok, res.total, res.fail),
            toMenuKeyboard()
          );
          if (cb.id) await bot.answerCallbackQuery(cb.id, { text: 'Отправил по часу' }).catch(()=>{});
          return;
        }
        if (data === 'admin:craft') {
          const me = await getByTelegramId(tgId);
          if (me) await setState(me.id, { state: 'ADMIN_AWAIT_CRAFT', payload: {} });
          await editOrReplaceFromCallback(
            bot, cb,
            craftPromptText(),
            toMenuKeyboard()
          );
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
      }

      // Навигация (универсальный возврат в главное меню)
      if (data === 'menu:back') {
        await editOrReplaceFromCallback(bot, cb, mainMenuText(), mainMenuKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }

      // Лидеры — вход из меню
      if (data === 'menu:leaderboard') {
        const page = 1;
        const { rows, total, pageSize } = await getLeaderboard(page, 10);
        await editOrReplaceFromCallback(
          bot, cb,
          leaderboardText({ rows, page, total, pageSize }),
          leaderboardKeyboard({ page, total, pageSize })
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }
      // Лидеры — пагинация
      if (data.startsWith('leaderboard:page:')) {
        const page = Math.max(1, Number(data.split(':')[2] ?? '1') || 1);
        const { rows, total, pageSize } = await getLeaderboard(page, 10);
        await editOrReplaceFromCallback(
          bot, cb,
          leaderboardText({ rows, page, total, pageSize }),
          leaderboardKeyboard({ page, total, pageSize })
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }

      // Профиль/цели
      if (data === 'menu:profile') {
        const user = await getByTelegramId(tgId);
        if (!user) {
          await editOrReplaceFromCallback(bot, cb, needStartText(), backOnlyKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        const text = await renderProfileSummary(user as any);
        await editOrReplaceFromCallback(bot, cb, text, profileKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }
      if (data === 'profile:goals') {
        const user = await getByTelegramId(tgId);
        if (!user) {
          await editOrReplaceFromCallback(bot, cb, needStartText(), backOnlyKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        const text = await renderGoals({ id: user.id, mode: (user.mode ?? 'zozh') as Mode });
        await editOrReplaceFromCallback(bot, cb, text, backToProfileKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }

      // Настройки
      const user = await getByTelegramId(tgId);
      if (!user) {
        await editOrReplaceFromCallback(bot, cb, needStartText(), backOnlyKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }
      if (data === 'menu:settings' || data === 'settings:back') {
        const mode = (user.mode ?? 'zozh') as Mode;
        const pollHour = user.poll_hour ?? 20;
        await editOrReplaceFromCallback(
          bot, cb,
          settingsRootText({ mode, pollHour, login: user.login ?? undefined }),
          settingsRootKeyboard()
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }
      if (data === 'settings:mode') {
        await editOrReplaceFromCallback(bot, cb, settingsModeText(),
          settingsModeKeyboard({ mode: (user.mode ?? 'zozh') as Mode }));
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }
      if (data.startsWith('mode:')) {
        const mode = data.split(':')[1] as Mode;
        if (mode !== 'zozh' && mode !== 'alco') { if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{}); return; }
        await updateMode(tgId, mode);
        await editOrReplaceFromCallback(bot, cb, settingsModeText(), settingsModeKeyboard({ mode }));
        if (cb.id) await bot.answerCallbackQuery(cb.id, { text: `Режим: ${mode === 'zozh' ? 'ЗОЖник' : 'Алкоголик'}` }).catch(()=>{});
        return;
      }
      if (data === 'settings:time') {
        await editOrReplaceFromCallback(bot, cb, settingsTimeText(),
          settingsTimeKeyboard({ pollHour: user.poll_hour ?? 20 }));
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }
      if (data.startsWith('settings:poll_hour:')) {
        const hour = Number(data.split(':')[2]);
        if (![18,19,20,21,22,23].includes(hour)) { if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{}); return; }
        await updatePollHour(tgId, hour);
        await editOrReplaceFromCallback(bot, cb, settingsTimeText(),
          settingsTimeKeyboard({ pollHour: hour }));
        if (cb.id) await bot.answerCallbackQuery(cb.id, { text: `Уведомления в ${String(hour).padStart(2,'0')}:00 (МСК)` }).catch(()=>{});
        return;
      }

      if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
    } catch (err) {
      log.error({ err }, 'callback error');
      try { if (cb?.id) await bot.answerCallbackQuery(cb.id).catch(()=>{}); } catch {}
    }
  });
}
