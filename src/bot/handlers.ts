// Маршрутизатор событий бота: команды, сообщения, callback_data.
// Реализуем:
//  - /start: createOrGet -> если login NULL -> WAITING_LOGIN, иначе если mode NULL -> WAITING_MODE, иначе меню
//  - text при WAITING_LOGIN: сохранить login -> выбрать режим
//  - callback mode: сохранить -> меню
//  - главное меню: profile/leaderboard/settings(заглушка)
//  - /profile: агрегаты по сериям и ответам
//  - /leaderboard: заглушка (реализуем на этапе 10)
//  - /poll: ручной запуск вопроса "Сегодня пил?" (Yes/No)

import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from '../lib/logger.js';
import { createOrGet, updateLogin, updateMode, getByTelegramId } from '../db/usersRepo.js';
import { getSession, setState, clearSession } from '../fsm/session.js';
import { showScreen, editOrReplaceFromCallback } from '../ui/screen.js';
import { askLoginText, chooseModeKeyboard, chooseModeText, mainMenuKeyboard, mainMenuText } from '../ui/text.js';
import { env } from '../config/env.js';
import { localDateYYYYMMDD } from '../lib/localDate.js';
import { applyAnswer } from '../db/streakRepo.js';
import { createPending, setPollAnswered, addConsumption } from '../db/pollRepo.js';
import { q1 } from '../db/sql.js';

const log = createLogger(process.env.LOG_LEVEL);

// Хелпер: рендер профиля
async function renderProfile(userId: number) {
  // Считаем простые метрики:
  // - серии из streaks
  // - дни "no"/"yes" из daily_polls
  const streak = await q1<{sober_current:number,sober_best:number,drunk_current:number,drunk_best:number}>(
    `SELECT sober_current, sober_best, drunk_current, drunk_best FROM streaks WHERE user_id=$1`, [userId]);

  const counts = await q1<{no_cnt:number, yes_cnt:number}>(
    `SELECT
       COALESCE(SUM(CASE WHEN answer='no'  THEN 1 ELSE 0 END),0)::int AS no_cnt,
       COALESCE(SUM(CASE WHEN answer='yes' THEN 1 ELSE 0 END),0)::int AS yes_cnt
     FROM daily_polls WHERE user_id=$1`,
    [userId]
  );

  const total = (counts?.no_cnt ?? 0) + (counts?.yes_cnt ?? 0);
  const soberPct = total > 0 ? Math.round((counts!.no_cnt / total) * 100) : 0;

  return (
    `<b>Профиль</b>\n\n` +
    `Серии:\n` +
    `• Трезвая: текущая ${streak?.sober_current ?? 0}, лучшая ${streak?.sober_best ?? 0}\n` +
    `• Пьяная:  текущая ${streak?.drunk_current ?? 0}, лучшая ${streak?.drunk_best ?? 0}\n\n` +
    `Дни:\n` +
    `• Трезвых: ${counts?.no_cnt ?? 0}\n` +
    `• Пьяных:  ${counts?.yes_cnt ?? 0}\n` +
    `• % трезвых: ${soberPct}%`
  );
}

// Главное меню
async function showMainMenu(bot: TelegramBot, chatId: number) {
  await showScreen(bot, chatId, mainMenuText(), { reply_markup: mainMenuKeyboard() });
}

export function registerHandlers(bot: TelegramBot) {
  // /start
  bot.onText(/^\/start(?:\s+.*)?$/i, async (msg) => {
    const chatId = msg.chat.id;
    const tgId = msg.from?.id!;
    const user = await createOrGet(tgId);

    // Если нет логина — просим логин и ставим WAITING_LOGIN
    if (!user.login) {
      await showScreen(bot, chatId, askLoginText());
      await setState(user.id, 'WAITING_LOGIN');
      return;
    }

    // Если нет режима — предлагаем выбор и ставим WAITING_MODE
    if (!user.mode) {
      await showScreen(bot, chatId, chooseModeText(), { reply_markup: chooseModeKeyboard() });
      await setState(user.id, 'WAITING_MODE');
      return;
    }

    // Иначе — меню
    await showMainMenu(bot, chatId);
    await clearSession(user.id);
  });

  // Текстовые сообщения: используем только для WAITING_LOGIN
  bot.on('message', async (msg) => {
    // Фильтруем системные/ботовые апдейты
    if (!msg.from || !msg.text || msg.text.startsWith('/')) return;

    const tgId = msg.from.id;
    const user = await getByTelegramId(tgId);
    if (!user) return;

    const session = await getSession(user.id);
    if (session.state === 'WAITING_LOGIN') {
      const login = msg.text.trim().slice(0, 32);
      await updateLogin(tgId, login || null);

      // Переходим к выбору режима
      await showScreen(bot, msg.chat.id, chooseModeText(), { reply_markup: chooseModeKeyboard() });
      await setState(user.id, 'WAITING_MODE');
      return;
    }

    // Иначе игнорируем; в будущем добавим другие состояния
  });

  // Callback: выбор режима и меню
  bot.on('callback_query', async (cb) => {
    try {
      const data = cb.data || '';
      const chatId = cb.message?.chat.id!;
      const tgId = cb.from.id;
      const user = await getByTelegramId(tgId);
      if (!user) return;

      // Выбор режима
      if (data.startsWith('mode:')) {
        const mode = data.split(':')[1] as 'zozh' | 'alco';
        await updateMode(tgId, mode);
        await editOrReplaceFromCallback(bot, cb, `<b>Режим установлен:</b> ${mode === 'zozh' ? 'ЗОЖник 🌿' : 'Алкоголик 🤪'}`);
        // Показать меню
        await showMainMenu(bot, chatId);
        await clearSession(user.id);
        return;
      }

      // Главное меню
      if (data === 'menu:profile') {
        const text = await renderProfile(user.id);
        await editOrReplaceFromCallback(bot, cb, text);
        return;
      }
      if (data === 'menu:leaderboard') {
        await editOrReplaceFromCallback(bot, cb, `<b>Лидеры</b>\n\nСкоро тут будет таблица топов.\n(Реализуем на этапе 10)`);
        return;
      }
      if (data === 'menu:settings') {
        await editOrReplaceFromCallback(bot, cb, `<b>Настройки</b>\n\nПозже добавим смену режима и часа опроса.`);
        return;
      }

      // Ручной опрос из кнопок: poll:yes / poll:no
      if (data === 'poll:no' || data === 'poll:yes') {
        const dateISO = localDateYYYYMMDD(env.DEFAULT_TZ); // пока из ENV
        await createPending(user.id, dateISO);
        if (data === 'poll:no') {
          await setPollAnswered(user.id, dateISO, 'no');
          await applyAnswer(user.id, 'no');
          await editOrReplaceFromCallback(bot, cb, `✅ Зафиксировал: <b>Нет</b>. День без алкоголя засчитан.`);
        } else {
          // Временно фиксируем 'other', 1 дринк (FSM выбора напитка сделаем позже)
          await setPollAnswered(user.id, dateISO, 'yes');
          await applyAnswer(user.id, 'yes');
          await addConsumption({ user_id: user.id, local_date: dateISO, drink_code: 'other', drinks_count: 1 });
          await editOrReplaceFromCallback(bot, cb, `🍷 Зафиксировал: <b>Да</b>. Добавил 1 дринк типа "other".`);
        }
        return;
      }
    } catch (err) {
      log.error({ err }, 'callback error');
    } finally {
      // Всегда отвечаем на callback, чтобы убрать "часики"
      if (cb.id) {
        bot.answerCallbackQuery(cb.id).catch(() => {});
      }
    }
  });

  // Команда /profile (дубликат меню-кнопки)
  bot.onText(/^\/profile$/, async (msg) => {
    const tgId = msg.from?.id!;
    const user = await getByTelegramId(tgId);
    if (!user) return;
    const text = await renderProfile(user.id);
    await showScreen(bot, msg.chat.id, text);
  });

  // Команда /leaderboard (заглушка)
  bot.onText(/^\/leaderboard$/, async (msg) => {
    await showScreen(bot, msg.chat.id, `<b>Лидеры</b>\n\nСкоро тут будет таблица топов.\n(Реализуем на этапе 10)`);
  });

  // Команда /poll — ручной триггер вопроса
  bot.onText(/^\/poll$/, async (msg) => {
    const tgId = msg.from?.id!;
    const user = await getByTelegramId(tgId);
    if (!user) {
      await showScreen(bot, msg.chat.id, `Сначала /start`);
      return;
    }
    const dateISO = localDateYYYYMMDD(env.DEFAULT_TZ);
    await createPending(user.id, dateISO);
    await showScreen(bot, msg.chat.id, `<b>Сегодня пил?</b>`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Нет, я молодец! ✅', callback_data: 'poll:no' }],
          [{ text: 'Да, было дело! 🍷', callback_data: 'poll:yes' }],
        ],
      },
    });
  });
}
