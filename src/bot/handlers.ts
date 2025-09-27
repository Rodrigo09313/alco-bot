// src/bot/handlers.ts
// ЕДИНЫЙ роутер: меню/профиль/цели/настройки + АДМИН-ПАНЕЛЬ.
// Русские комментарии. В админке все возвраты идут в ГЛАВНОЕ МЕНЮ.

import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from '../lib/logger';
import {
  createOrGet, updateLogin, getByTelegramId,
  updateMode, updatePollHour, listAllUsers
} from '../db/usersRepo';
import { getSession, setState, clearSession } from '../fsm/session';
import { showScreen, editOrReplaceFromCallback } from '../ui/screen';
import {
  askLoginText, chooseModeKeyboard, chooseModeText,
  mainMenuKeyboard, mainMenuText,
  backOnlyKeyboard, backToProfileKeyboard,
  profileSummaryText, profileKeyboard,
  settingsRootText, settingsRootKeyboard,
  settingsModeText, settingsModeKeyboard,
  settingsTimeText, settingsTimeKeyboard,
  leaderboardText, leaderboardKeyboard,
  todayPollText, todayPollKeyboard,
  achievementsText,
  type Mode,
} from '../ui/text';
import { q1 } from '../db/sql';
import { pollAll, pollUsersByHour } from './scheduler';
import { createCraftPoll } from '../db/pollRepo';
import { getLeaderboard } from '../db/leaderboardRepo';

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

  let goals: { [k: string]: { title: string; done: boolean; hint?: string } } = {};
  const mode = user.mode;
  if (mode === 'zozh') {
    goals = {
      g1: { title: 'Серия трезвости 7 дней',      done: sCur >= 7,  hint: `Текущая: ${sCur}` },
      g2: { title: 'Лучшая трезвая серия ≥ 21',   done: sBest >= 21, hint: `Лучшая: ${sBest}` },
      g3: { title: '≥ 80% трезвых за 30 дней',    done: sober30pct >= 80, hint: `${sober30pct}%` },
      g4: { title: '0 порций за 30 дней',         done: portions === 0,   hint: `Порций: ${portions}` },
      g5: { title: 'Без запоев (пьян. серия < 2)',done: dCur < 2,         hint: `Пьян. серия: ${dCur}` },
    };
  } else {
    goals = {
      g1: { title: 'Серия пьянства 3 дня',        done: dCur >= 3,  hint: `Текущая: ${dCur}` },
      g2: { title: 'Лучшая пьяная серия ≥ 7',     done: dBest >= 7, hint: `Лучшая: ${dBest}` },
      g3: { title: '≤ 30% трезвых за 30 дней',    done: sober30pct <= 30, hint: `${sober30pct}%` },
      g4: { title: '≥ 30 порций за 30 дней',      done: portions >= 30,   hint: `Порций: ${portions}` },
      g5: { title: 'Нет трезвых серий ≥ 3',       done: sCur < 3,         hint: `Трезв. серия: ${sCur}` },
    };
  }
  return (
    `<b>${mode === 'zozh' ? '🎯 Цели ЗОЖ' : '🎯 Цели Алко-режима'}</b>\n\n` +
    Object.values(goals).map(g => `${g.done ? '✅' : '⭕️'} ${g.title}` + (g.hint ? `\n   <i>${g.hint}</i>` : '')).join('\n')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Админ UI (кнопки админки остаются, но ВСЕ возвраты ведут в главное меню)
function adminText(): string {
  return `<b>Админ-панель</b>\nДоступно:\n• Опросить всех\n• Опросить по текущему часу (МСК)\n• Крафтовый опрос (ручной вопрос)`;
}
function adminKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🚨 Опросить всех сейчас', callback_data: 'admin:poll_all' }],
      [{ text: '🕐 Опросить по текущему часу (МСК)', callback_data: 'admin:poll_hour' }],
      [{ text: '🧪 Крафтовый опрос', callback_data: 'admin:craft' }],
      [{ text: '← В меню', callback_data: 'menu:back' }], // ← сразу в основное меню
    ],
  };
}
const toMenuKb: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [[{ text: '← В меню', callback_data: 'menu:back' }]],
};

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
            await showScreen(bot, msg.chat.id, 'Текст пуст. Пришли вопрос строкой.', { reply_markup: toMenuKb });
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

          // Итог сразу с кнопкой "В меню"
          await showScreen(
            bot, msg.chat.id,
            `✅ Крафтовый опрос разослан.\nOK: <b>${ok}</b> / ${users.length}\nОшибок: <b>${fail}</b>`,
            { reply_markup: toMenuKb }
          );
          return;
        }
      }

      // Обычный ввод логина
      const tgId = msg.from.id;
      const user = await getByTelegramId(tgId); if (!user) return;

      let session = await getSession(user.id);
      if (!session) { session = { state: 'IDLE', payload: {} }; await setState(user.id, session).catch(()=>{}); }

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
    if (!user) return showScreen(bot, msg.chat.id, 'Сначала /start', { reply_markup: mainMenuKeyboard() });
    const text = await renderProfileSummary(user as any);
    await showScreen(bot, msg.chat.id, text, { reply_markup: profileKeyboard() });
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
        // Любой "назад" из админки — в ГЛАВНОЕ МЕНЮ
        if (data === 'admin:back') {
          await editOrReplaceFromCallback(bot, cb, mainMenuText(), mainMenuKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        if (data === 'admin:poll_all') {
          const res = await pollAll(bot);
          await editOrReplaceFromCallback(
            bot, cb,
            `✅ Опрос для всех.\nOK: <b>${res.ok}</b> / ${res.total}\nОшибок: <b>${res.fail}</b>`,
            toMenuKb
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
            `✅ Опрос по часу (МСК ${String(hour).padStart(2,'0')}:00).\nOK: <b>${res.ok}</b> / ${res.total}\nОшибок: <b>${res.fail}</b>`,
            toMenuKb
          );
          if (cb.id) await bot.answerCallbackQuery(cb.id, { text: 'Отправил по часу' }).catch(()=>{});
          return;
        }
        if (data === 'admin:craft') {
          const me = await getByTelegramId(tgId);
          if (me) await setState(me.id, { state: 'ADMIN_AWAIT_CRAFT', payload: {} });
          // Промпт с кнопкой "В меню", а не "в админку"
          await editOrReplaceFromCallback(
            bot, cb,
            `<b>Крафтовый опрос</b>\n\nПришли ТЕКСТ вопроса одним сообщением.\nВсем пользователям уйдёт «Да/Нет», ответы сохранятся.`,
            toMenuKb
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

      // Профиль/цели
      if (data === 'menu:profile') {
        const user = await getByTelegramId(tgId);
        if (!user) {
          await editOrReplaceFromCallback(bot, cb, 'Сначала /start', backOnlyKeyboard());
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
          await editOrReplaceFromCallback(bot, cb, 'Сначала /start', backOnlyKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        const text = await renderGoals({ id: user.id, mode: (user.mode ?? 'zozh') as Mode });
        await editOrReplaceFromCallback(bot, cb, text, backToProfileKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }

      // Топ игроков
      if (data === 'menu:leaderboard') {
        const user = await getByTelegramId(tgId);
        if (!user) {
          await editOrReplaceFromCallback(bot, cb, 'Сначала /start', backOnlyKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        
        const leaderboard = await getLeaderboard(1, 10, 'current', (user.mode ?? 'zozh') as Mode);
        
        const text = leaderboardText({
          ...leaderboard,
          type: 'current',
          mode: (user.mode ?? 'zozh') as Mode
        });
        await editOrReplaceFromCallback(bot, cb, text, leaderboardKeyboard(leaderboard));
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }

      // Достижения
      if (data === 'profile:achievements') {
        const user = await getByTelegramId(tgId);
        if (!user) {
          await editOrReplaceFromCallback(bot, cb, 'Сначала /start', backOnlyKeyboard());
          if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
          return;
        }
        
        const totals = await q1<{ no_cnt: number; yes_cnt: number }>`
          SELECT COALESCE(SUM((answer='no')::int),0)::int AS no_cnt,
                 COALESCE(SUM((answer='yes')::int),0)::int AS yes_cnt
          FROM daily_polls WHERE user_id = ${user.id}
        `;
        
        const soberDays = totals?.no_cnt ?? 0;
        const drunkDays = totals?.yes_cnt ?? 0;
        
        const text = achievementsText(user.mode as Mode, soberDays, drunkDays);
        await editOrReplaceFromCallback(bot, cb, text, backToProfileKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(()=>{});
        return;
      }

      // Настройки
      const user = await getByTelegramId(tgId);
      if (!user) {
        await editOrReplaceFromCallback(bot, cb, 'Сначала /start', backOnlyKeyboard());
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
