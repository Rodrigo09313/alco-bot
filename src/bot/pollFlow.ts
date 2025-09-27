// src/bot/pollFlow.ts
// Флоу ручного опроса "Сегодня пил?": Да/Нет → напиток → количество.
// ВАЖНО: состояние опроса храним в session.payload.poll, чтобы не ломать типы FSM.

import type TelegramBot from 'node-telegram-bot-api';
import {
  todayPollText,
  todayPollKeyboard,
  chooseDrinkText,
  chooseDrinkKeyboard,
  chooseAmountText,
  chooseAmountKeyboard,
  backOnlyKeyboard,
  mainMenuText,
  mainMenuKeyboard,
} from '../ui/text';
import { listActiveDrinks, getDrinkById } from '../db/drinksRepo';
import { createManualPoll, setPollAnswerNo, setPollAnswerYes, getPollById } from '../db/pollRepo';
import { addConsumption } from '../db/consumptionRepo';
import { touchStreaksOnNo, touchStreaksOnYes } from '../db/streakRepo';
import { getByTelegramId, createOrGet } from '../db/usersRepo';
import { getSession, setState } from '../fsm/session';
import { idle, type PollFSMState } from '../fsm/pollStates';
import { editOrReplaceFromCallback } from '../ui/screen';

// Утилита: безопасно получить payload (и клон) из сессии
function getPayload(session: any): Record<string, any> {
  const p = (session && session.payload) ? session.payload : {};
  return { ...p };
}

// SLM-хелпер: редактируем «живое сообщение» из callback
// ПЕРЕДАЁМ inline-клавиатуру напрямую (а не объект с reply_markup)
async function showFromCb(
  bot: TelegramBot,
  cb: TelegramBot.CallbackQuery,
  text: string,
  keyboard: TelegramBot.InlineKeyboardMarkup
) {
  await editOrReplaceFromCallback(bot, cb, text, keyboard);
}

export function registerPollFlow(bot: TelegramBot) {
  bot.on('callback_query', async (q) => {
    try {
      const data = q.data || '';
      const chatId = q.message?.chat.id;
      const tgId = q.from?.id;
      if (!chatId || !tgId) {
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // Всегда работаем с userId из БД
      let user = await getByTelegramId(tgId);
      if (!user) user = await createOrGet(tgId);

      // Навигация назад в меню
      if (data === 'menu:back') {
        await showFromCb(bot, q, mainMenuText(), mainMenuKeyboard());
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 1) Старт ручного опроса
      if (data === 'poll:manual') {
        const { id: pollId } = await createManualPoll(user.id);

        const session = await getSession(user.id);
        const payload = getPayload(session);
        const newState: PollFSMState = { name: 'POLL_YESNO', pollId };

        // Сохраняем poll в payload
        payload.poll = newState;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

        await showFromCb(bot, q, todayPollText(), todayPollKeyboard());
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 2) Ответ "Нет"
      if (data === 'poll:answer:no') {
        const session = await getSession(user.id);
        const payload = getPayload(session);
        const pollState = payload.poll as PollFSMState | undefined;

        const pollId =
          pollState && (pollState as any).pollId
            ? (pollState as any).pollId
            : (await createManualPoll(user.id)).id;

        // Идемпотентность: если уже отвечено сегодня — ничего не меняем
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

        await setPollAnswerNo(pollId);
        await touchStreaksOnNo(user.id);

        // Сбрасываем состояние опроса
        payload.poll = idle;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

        await showFromCb(bot, q, 'Записал: <b>не пил</b> 👏', backOnlyKeyboard());
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 3) Ответ "Да" -> список напитков
      if (data === 'poll:answer:yes') {
        const session = await getSession(user.id);
        const payload = getPayload(session);
        const pollState = payload.poll as PollFSMState | undefined;

        const pollId =
          pollState && (pollState as any).pollId
            ? (pollState as any).pollId
            : (await createManualPoll(user.id)).id;

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

        // Фиксируем факт "Да" один раз (стриками тоже один раз двигаем)
        await setPollAnswerYes(pollId);
        await touchStreaksOnYes(user.id);

        // Переходим к выбору напитка
        const drinks = await listActiveDrinks();
        const newState: PollFSMState = { name: 'POLL_CHOOSE_DRINK', pollId };

        payload.poll = newState;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

        await showFromCb(bot, q, chooseDrinkText(), chooseDrinkKeyboard(drinks));
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 3.1) Назад из выбора напитка в Да/Нет
      if (data === 'poll:back_to_yesno') {
        const session = await getSession(user.id);
        const payload = getPayload(session);
        const pollState = payload.poll as PollFSMState | undefined;
        const pollId = (pollState as any)?.pollId;

        payload.poll = { name: 'POLL_YESNO', pollId } as PollFSMState;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

        await showFromCb(bot, q, todayPollText(), todayPollKeyboard());
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
        const payload = getPayload(session);
        const pollState = payload.poll as PollFSMState | undefined;
        if (!pollState || (pollState.name !== 'POLL_CHOOSE_DRINK' && pollState.name !== 'POLL_YESNO')) {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Опрос не активен' }).catch(() => {});
          return;
        }

        const pollId =
          (pollState as any).pollId ??
          (await (async () => {
            const created = await createManualPoll(user.id);
            return created.id;
          })());

        // Готовим следующее состояние (drinkCode кладём через any — это наш внутренний атрибут)
        const newState: PollFSMState = {
          name: 'POLL_CHOOSE_AMOUNT',
          pollId,
          drinkId: drink.id,
          drinkName: drink.name,
          // @ts-expect-error: расширяем состояние для внутреннего флоу
          drinkCode: drink.code,
        };

        payload.poll = newState;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

        await showFromCb(bot, q, chooseAmountText(drink.name), chooseAmountKeyboard());
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }

      // 4.1) Назад из выбора количества к списку напитков
      if (data === 'poll:back_to_drinks') {
        const session = await getSession(user.id);
        const payload = getPayload(session);
        const pollState = payload.poll as PollFSMState | undefined;
        const pollId = (pollState as any)?.pollId;
        const drinks = await listActiveDrinks();

        payload.poll = { name: 'POLL_CHOOSE_DRINK', pollId } as PollFSMState;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

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
        const payload = getPayload(session);
        const pollState = payload.poll as PollFSMState | undefined;
        if (!pollState || pollState.name !== 'POLL_CHOOSE_AMOUNT') {
          if (q.id) await bot.answerCallbackQuery(q.id, { text: 'Опрос не активен' }).catch(() => {});
          return;
        }

        // Пишем consumption_records с drink_code (FK на drinks(code))
        await addConsumption({
          userId: user.id,
          pollId: (pollState as any).pollId,
          // @ts-expect-error берём из расширенного состояния (см. выше)
          drinkCode: (pollState as any).drinkCode,
          amount,
        });

        // Сбрасываем состояние опроса
        payload.poll = idle;
        await setState(user.id, { state: session?.state ?? 'IDLE', payload });

        await showFromCb(
          bot,
          q,
          `Записал: <b>${(pollState as any).drinkName}</b> × <b>${amount}</b>.`,
          backOnlyKeyboard()
        );
        if (q.id) await bot.answerCallbackQuery(q.id).catch(() => {});
        return;
      }
    } catch (err) {
      // Логирование ошибок в одном месте; ACK, чтобы Telegram не ретраил
      // eslint-disable-next-line no-console
      console.error('pollFlow error:', err);
      try {
        if (q?.id) await bot.answerCallbackQuery(q.id).catch(() => {});
      } catch {}
    }
  });
}
