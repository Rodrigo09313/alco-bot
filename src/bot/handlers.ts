// ЕДИНЫЙ роутер команд/кнопок без дублей.
// Здесь всё: /start, /menu, профиль, настройки, смена режима и часа опроса.
// Меню и экраны рендерим ОДНИМ местом, чтобы не плодить сообщения.

import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from '../lib/logger';
import { createOrGet, updateLogin, updateMode, updatePollHour, getByTelegramId } from '../db/usersRepo';
import { getSession, setState, clearSession } from '../fsm/session';
import { showScreen, editOrReplaceFromCallback } from '../ui/screen';
import {
  askLoginText,
  chooseModeKeyboard,
  chooseModeText,
  mainMenuKeyboard,
  mainMenuText,
  settingsText,
  settingsKeyboard,
  backOnlyKeyboard,
  type Mode,
} from '../ui/text';
import { q1 } from '../db/sql';

const log = createLogger(process.env.LOG_LEVEL);

/** Рендер профиля — простой HTML */
async function renderProfile(userId: number) {
  const streak = await q1<{
    sober_current: number;
    sober_best: number;
    drunk_current: number;
    drunk_best: number;
  }>`
    SELECT sober_current, sober_best, drunk_current, drunk_best
    FROM streaks WHERE user_id = ${userId}
  `;

  const counts = await q1<{ no_cnt: number; yes_cnt: number }>`
    SELECT
      COALESCE(SUM(CASE WHEN answer='no'  THEN 1 ELSE 0 END),0)::int AS no_cnt,
      COALESCE(SUM(CASE WHEN answer='yes' THEN 1 ELSE 0 END),0)::int AS yes_cnt
    FROM daily_polls
    WHERE user_id = ${userId}
  `;

  const noCnt = counts?.no_cnt ?? 0;
  const yesCnt = counts?.yes_cnt ?? 0;
  const total = noCnt + yesCnt;
  const soberPct = total > 0 ? Math.round((noCnt / total) * 100) : 0;

  return (
    `<b>Профиль</b>\n\n` +
    `Серии:\n` +
    `• Трезвая: текущая ${streak?.sober_current ?? 0}, лучшая ${streak?.sober_best ?? 0}\n` +
    `• Пьяная:  текущая ${streak?.drunk_current ?? 0}, лучшая ${streak?.drunk_best ?? 0}\n\n` +
    `Дни:\n` +
    `• Трезвых: ${noCnt}\n` +
    `• Пьяных:  ${yesCnt}\n` +
    `• % трезвых: ${soberPct}%`
  );
}

/** Показать главное меню (SLM) — одно сообщение с inline-кнопками */
async function showMainMenu(bot: TelegramBot, chatId: number) {
  await showScreen(bot, chatId, mainMenuText(), { reply_markup: mainMenuKeyboard() });
}

/** Регистрация обработчиков — ОДИН раз */
export function registerHandlers(bot: TelegramBot) {
  // /start — онбординг
  bot.onText(/^\/start(?:\s+.*)?$/i, async (msg) => {
    try {
      const chatId = msg.chat.id;
      const tgId = msg.from?.id;
      if (!tgId) return;

      const user = await createOrGet(tgId);

      // 1) Просим логин
      if (!user.login) {
        await showScreen(bot, chatId, askLoginText());
        await setState(user.id, { state: 'WAITING_LOGIN', payload: {} });
        return;
      }

      // 2) Выбор режима (inline)
      if (!user.mode) {
        await showScreen(bot, chatId, chooseModeText(), { reply_markup: chooseModeKeyboard() });
        await setState(user.id, { state: 'WAITING_MODE', payload: {} });
        return;
      }

      // 3) Главное меню
      await showMainMenu(bot, chatId);
      await clearSession(user.id);
    } catch (err) {
      log.error({ err }, 'error in /start handler');
    }
  });

  // Текстовые сообщения — только ввод логина
  bot.on('message', async (msg) => {
    try {
      if (!msg.from || !msg.text) return;
      if (msg.text.startsWith('/')) return;

      const tgId = msg.from.id;
      const user = await getByTelegramId(tgId);
      if (!user) return;

      let session = await getSession(user.id);
      if (!session) {
        session = { state: 'IDLE', payload: {} };
        try { await setState(user.id, session); } catch {}
      }

      if (session.state === 'WAITING_LOGIN') {
        const login = msg.text.trim().slice(0, 32) || null;
        await updateLogin(tgId, login);
        await setState(user.id, { state: 'WAITING_MODE', payload: {} });

        // Переход к выбору режима
        await showScreen(bot, msg.chat.id, chooseModeText(), { reply_markup: chooseModeKeyboard() });
        return;
      }
    } catch (err) {
      log.error({ err }, 'error in message handler');
    }
  });

  // /menu — одно сообщение-меню (через SLM)
  bot.onText(/^\/menu$/, async (msg) => {
    try {
      await showMainMenu(bot, msg.chat.id);
    } catch (err) {
      log.error({ err }, '/menu handler error');
    }
  });

  // /profile — экран профиля + меню
  bot.onText(/^\/profile$/, async (msg) => {
    try {
      const tgId = msg.from?.id;
      if (!tgId) return;
      const user = await getByTelegramId(tgId);
      if (!user) {
        await showScreen(bot, msg.chat.id, 'Сначала /start', { reply_markup: mainMenuKeyboard() });
        return;
      }
      const text = await renderProfile(user.id);
      await showScreen(bot, msg.chat.id, text, { reply_markup: mainMenuKeyboard() });
    } catch (err) {
      log.error({ err }, '/profile handler error');
    }
  });

  // /leaderboard — заглушка + меню
  bot.onText(/^\/leaderboard$/, async (msg) => {
    try {
      await showScreen(
        bot,
        msg.chat.id,
        `<b>Лидеры</b>\n\nСкоро тут будет таблица топов.\n(Реализуем на этапе 10)`,
        { reply_markup: mainMenuKeyboard() }
      );
    } catch (err) {
      log.error({ err }, '/leaderboard handler error');
    }
  });

  // Callback queries — РЕДАКТИРУЕМ текущее сообщение (без showScreen после edit!)
  bot.on('callback_query', async (cb) => {
    try {
      const data = cb.data ?? '';
      const tgId = cb.from?.id;
      if (!tgId) { if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {}); return; }

      const user = await getByTelegramId(tgId);
      if (!user) {
        await editOrReplaceFromCallback(bot, cb, 'Сначала /start', backOnlyKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
        return;
      }

      // ==== Навигация меню ====
      if (data === 'menu:back') {
        await editOrReplaceFromCallback(bot, cb, mainMenuText(), mainMenuKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
        return;
      }

      if (data === 'menu:settings') {
        const mode = (user.mode as Mode) || 'zozh';
        const pollHour = user.poll_hour ?? 20;
        await editOrReplaceFromCallback(
          bot, cb,
          settingsText({ mode, pollHour, login: user.login ?? undefined }),
          settingsKeyboard({ mode, pollHour })
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
        return;
      }

      if (data === 'menu:profile') {
        const text = await renderProfile(user.id);
        await editOrReplaceFromCallback(bot, cb, text, backOnlyKeyboard());
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
        return;
      }

      if (data === 'menu:leaderboard') {
        await editOrReplaceFromCallback(
          bot, cb,
          `🏆 Лидеры — подключим позже с кэшем.`,
          backOnlyKeyboard()
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
        return;
      }

      // ==== Смена режима ====
      if (data.startsWith('mode:')) {
        const mode = data.split(':')[1] as Mode;
        if (mode !== 'zozh' && mode !== 'alco') { if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {}); return; }

        await updateMode(user.id, mode);
        const updated = await getByTelegramId(tgId);
        const newMode = (updated!.mode as Mode) || 'zozh';
        const pollHour = updated!.poll_hour ?? 20;

        await editOrReplaceFromCallback(
          bot, cb,
          settingsText({ mode: newMode, pollHour, login: updated!.login ?? undefined }),
          settingsKeyboard({ mode: newMode, pollHour })
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id, { text: `Режим: ${newMode === 'zozh' ? 'ЗОЖ' : 'Алко'}` }).catch(() => {});
        return;
      }

      // ==== Смена времени опроса ====
      if (data.startsWith('settings:poll_hour:')) {
        const hour = Number(data.split(':')[2]);
        if (![18, 19, 20, 21, 22].includes(hour)) { if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {}); return; }

        await updatePollHour(user.id, hour);
        const updated = await getByTelegramId(tgId);
        const newMode = (updated!.mode as Mode) || 'zozh';
        const pollHour = updated!.poll_hour ?? hour;

        await editOrReplaceFromCallback(
          bot, cb,
          settingsText({ mode: newMode, pollHour, login: updated!.login ?? undefined }),
          settingsKeyboard({ mode: newMode, pollHour })
        );
        if (cb.id) await bot.answerCallbackQuery(cb.id, { text: `Опрос в ${hour}:00` }).catch(() => {});
        return;
      }

      // Прочее — просто ACK
      if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
    } catch (err) {
      log.error({ err }, 'callback error');
      try { if (cb?.id) await bot.answerCallbackQuery(cb.id).catch(() => {}); } catch {}
    }
  });
}
