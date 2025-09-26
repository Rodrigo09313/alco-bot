// SLM (Single Live Message): в каждом чате держим одно "живое" сообщение.
// При показе нового экрана удаляем старое (если есть), отправляем новое и запоминаем message_id.
// При редактировании из callback пытаемся editMessageText, если нельзя — отправляем новое.
// Храним last_message_id в Redis по ключу slm:{chatId}.

import TelegramBot, { SendMessageOptions, EditMessageTextOptions, InlineKeyboardMarkup } from 'node-telegram-bot-api';
import { getRedis } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger(process.env.LOG_LEVEL);
const r = getRedis();

function key(chatId: number | string) {
  return `slm:${chatId}`;
}

/** Получить последний message_id для чата */
export async function getLastMessageId(chatId: number): Promise<number | null> {
  const v = await r.get(key(chatId));
  return v ? Number(v) : null;
}

/** Сохранить последний message_id для чата */
async function setLastMessageId(chatId: number, messageId: number) {
  await r.set(key(chatId), String(messageId));
}

/** Удалить сохранённый message_id (без удаления сообщения в чате) */
export async function clearLastMessage(chatId: number) {
  await r.del(key(chatId));
}

/**
 * Показать экран: удаляет предыдущее SLM-сообщение, отправляет новое.
 * text — MarkdownV2 или HTML (ниже используем HTML для простоты).
 */
export async function showScreen(bot: TelegramBot, chatId: number, text: string, opts: Omit<SendMessageOptions, 'chat_id'> = {}) {
  // Пытаемся удалить предыдущее сообщение
  const lastId = await getLastMessageId(chatId);
  if (lastId) {
    try {
      await bot.deleteMessage(chatId, String(lastId));
    } catch (err: any) {
      // Игнорируем типовые ошибки Telegram API
      const msg = String(err?.response?.body?.description ?? err?.message ?? err);
      if (!/message to delete not found|message can't be deleted/i.test(msg)) {
        log.debug({ err: msg }, 'SLM: delete previous failed (ignored)');
      }
    }
  }

  // Отправляем новое
  const sent = await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...opts,
  });

  await setLastMessageId(chatId, sent.message_id);
  return sent;
}

/**
 * Редактировать экран из callback. Если не получилось — отправляем новый экран.
 */
export async function editOrReplaceFromCallback(bot: TelegramBot, cb: TelegramBot.CallbackQuery, text: string, kb?: InlineKeyboardMarkup) {
  const chatId = cb.message!.chat.id;
  const msgId = cb.message!.message_id;

  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: kb,
    } as EditMessageTextOptions);
    return;
  } catch (err: any) {
    const msg = String(err?.response?.body?.description ?? err?.message ?? err);
    // "message is not modified" — это не ошибка для нас
    if (/message is not modified/i.test(msg)) return;

    // Иначе — отправляем новый экран в режиме SLM
    await showScreen(bot, chatId, text, { reply_markup: kb });
  }
}

/** Обновить текущий экран без удаления, с graceful fallback */
export async function updateScreen(bot: TelegramBot, chatId: number, text: string, kb?: InlineKeyboardMarkup) {
  const lastId = await getLastMessageId(chatId);
  if (!lastId) {
    await showScreen(bot, chatId, text, { reply_markup: kb });
    return;
  }
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: lastId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: kb,
    } as EditMessageTextOptions);
  } catch (err: any) {
    const msg = String(err?.response?.body?.description ?? err?.message ?? err);
    if (/message is not modified/i.test(msg)) return;
    // Если редактирование не получилось, отправим новый экран
    await showScreen(bot, chatId, text, { reply_markup: kb });
  }
}
