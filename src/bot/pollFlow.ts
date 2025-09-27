// Поток опроса: поддержка callback вида poll:answer:yes[:pollId] / poll:answer:no[:pollId].
// ВАЖНО: этот модуль перехватывает ТОЛЬКО префикс "poll:" и НЕ трогает другие коллбэки.

import type TelegramBot from 'node-telegram-bot-api';
import {
  todayPollText,
  todayPollKeyboard,
  chooseDrinkText,
  chooseDrinkKeyboard,
  chooseAmountText,
  chooseAmountKeyboard,
  backOnlyKeyboard,
} from '../ui/text.js';
import { listActiveDrinks, getDrinkById } from '../db/drinksRepo.js';
import { createManualPoll, setPollAnswerNo, setPollAnswerYes, getPollById } from '../db/pollRepo.js';
import { addConsumption } from '../db/consumptionRepo.js';
import { touchStreaksOnNo, touchStreaksOnYes } from '../db/streakRepo.js';
import { getByTelegramId, createOrGet } from '../db/usersRepo.js';
import { getSession, setState } from '../fsm/session.js';
import { idle, type PollFSMState } from '../fsm/pollStates.js';
import { editOrReplaceFromCallback } from '../ui/screen.js';

async function showFromCb(
  bot: TelegramBot,
  cb: TelegramBot.CallbackQuery,
  text: string,
  keyboard: TelegramBot.InlineKeyboardMarkup
) {
  await editOrReplaceFromCallback(bot, cb, text, keyboard);
}

function parseAnswerData(data: string): { kind: 'yes'|'no'; pollId?: number } | null {
  const m = data.match(/^poll:answer:(yes|no)(?::(\d+))?$/);
  if (!m) return null;
  return { kind: m[1] as 'yes'|'no', pollId: m[2] ? Number(m[2]) : undefined };
}

export function registerPollFlow(bot: TelegramBot) {
  bot.on('callback_query', async (q) => {
    try {
      const data = q.data || '';
      if (!data.startsWith('poll:')) {
        // Не наш коллбэк — пропускаем, пусть обрабатывают другие роуты.
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      const chatId = q.message?.chat.id;
      const tgId = q.from?.id;
      if (!chatId || !tgId) {
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      let user = await getByTelegramId(tgId);
      if (!user) user = await createOrGet(tgId);

      // 1) Ручной старт daily
      if (data === 'poll:manual') {
        const { id: pollId } = await createManualPoll(user.id);
        const session = await getSession(user.id);
        const newState: PollFSMState = { name: 'POLL_YESNO', pollId };
        await setState(user.id, { ...session, poll: newState });
        await showFromCb(bot, q, todayPollText(), todayPollKeyboard(pollId));
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 2) Ответ Да/Нет (с поддержкой pollId)
      const ans = parseAnswerData(data);
      if (ans) {
        let pollId = ans.pollId;
        if (!pollId) {
          const session = await getSession(user.id);
          const pollState = session?.poll as PollFSMState | undefined;
          pollId = pollState && (pollState as any).pollId
            ? (pollState as any).pollId
            : (await createManualPoll(user.id)).id;
        }

        const existing = await getPollById(pollId);
        if (existing?.status === 'answered') {
          await showFromCb(
            bot,
            q,
            `За сегодня уже зафиксировано: <b>${existing.answer === 'yes' ? 'Да' : 'Нет'}</b>.`,
            backOnlyKeyboard()
          );
          if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
          return;
        }

        if (ans.kind === 'no') {
          await setPollAnswerNo(pollId);
          await touchStreaksOnNo(user.id);
          await setState(user.id, { ...(await getSession(user.id)), poll: idle });
          await showFromCb(bot, q, 'Записал: <b>не пил</b> 👏', backOnlyKeyboard());
          if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
          return;
        }

        // Да -> список напитков
        await setPollAnswerYes(pollId);
        await touchStreaksOnYes(user.id);

        const drinks = await listActiveDrinks();
        const newState: PollFSMState = { name: 'POLL_CHOOSE_DRINK', pollId };
        await setState(user.id, { ...(await getSession(user.id)), poll: newState });

        await showFromCb(bot, q, chooseDrinkText(), chooseDrinkKeyboard(drinks));
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 3) Назад к Да/Нет
      if (data === 'poll:back_to_yesno') {
        const session = await getSession(user.id);
        const pollState = session?.poll as PollFSMState | undefined;
        const pollId = (pollState as any)?.pollId;
        await setState(user.id, { ...session, poll: { name: 'POLL_YESNO', pollId } });
        await showFromCb(bot, q, todayPollText(), todayPollKeyboard(pollId));
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 4) Выбор напитка
      if (data.startsWith('poll:drink:')) {
        const drinkId = Number(data.split(':')[2]);
        if (!Number.isFinite(drinkId)) {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Неверный напиток' }).catch(() => {});
          return;
        }

        const drink = await getDrinkById(drinkId);
        if (!drink) {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Напиток не найден' }).catch(() => {});
          return;
        }

        const session = await getSession(user.id);
        const pollState = session?.poll as PollFSMState | undefined;
        if (!pollState || (pollState.name !== 'POLL_CHOOSE_DRINK' && pollState.name !== 'POLL_YESNO')) {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Опрос не активен' }).catch(() => {});
          return;
        }

        const pollId =
          (pollState as any).pollId ??
          (await (async () => (await createManualPoll(user.id)).id)());

        const newState: PollFSMState = {
          name: 'POLL_CHOOSE_AMOUNT',
          pollId,
          drinkId: drink.id,
          drinkName: drink.name,
          // @ts-expect-error: расширяем состояние под наш флоу
          drinkCode: drink.code,
        };
        await setState(user.id, { ...session, poll: newState });

        await showFromCb(bot, q, chooseAmountText(drink.name), chooseAmountKeyboard());
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 4.1) Назад к списку напитков
      if (data === 'poll:back_to_drinks') {
        const session = await getSession(user.id);
        const pollState = session?.poll as PollFSMState | undefined;
        const pollId = (pollState as any)?.pollId;
        const drinks = await listActiveDrinks();
        await setState(user.id, { ...session, poll: { name: 'POLL_CHOOSE_DRINK', pollId } });
        await showFromCb(bot, q, chooseDrinkText(), chooseDrinkKeyboard(drinks));
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 5) Выбор количества
      if (data.startsWith('poll:amount:')) {
        const amount = Number(data.split(':')[2]);
        if (!Number.isFinite(amount) || amount <= 0) {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Неверное количество' }).catch(() => {});
          return;
        }

        const session = await getSession(user.id);
        const pollState = session?.poll as PollFSMState | undefined;
        if (!pollState || pollState.name !== 'POLL_CHOOSE_AMOUNT') {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Опрос не активен' }).catch(() => {});
          return;
        }

        await addConsumption({
          userId: user.id,
          pollId: (pollState as any).pollId,
          // @ts-expect-error: есть в состоянии
          drinkCode: (pollState as any).drinkCode,
          amount,
        });

        await setState(user.id, { ...session, poll: idle });
        await showFromCb(
          bot,
          q,
          `Записал: <b>${(pollState as any).drinkName}</b> × <b>${amount}</b>.`,
          backOnlyKeyboard()
        );
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
    } catch (err) {
      console.error('pollFlow error:', err);
      try { if (q?.id) await bot.answerCallbackQuery(q.id).catch(()=>{}); } catch {}
    }
  });
}
