// SLM (Single Live Message): держим одно "живое" сообщение на чат.
// - showScreen: удаляет прошлое SLM-сообщение, шлёт новое, запоминает message_id.
// - editOrReplaceFromCallback: редактируем тот же message_id,
//   если kb не передали — сохраняем текущую клавиатуру, чтобы кнопки не исчезали.
//   При успехе помечаем message_id как актуальный SLM, при неудаче — шлём новый.
//
// ВАЖНО: чтобы не плодить сообщения, после callback редактируем существующий,
//        а не делаем edit + showScreen подряд.

import TelegramBot, {
  SendMessageOptions,
  EditMessageTextOptions,
  InlineKeyboardMarkup,
} from 'node-telegram-bot-api';
import { getRedis } from '../lib/redis';
import { createLogger } from '../lib/logger';

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

/** Показать экран: удаляем прошлый SLM, отправляем новый, запоминаем id */
export async function showScreen(
  bot: TelegramBot,
  chatId: number,
  text: string,
  opts: Omit<SendMessageOptions, 'chat_id'> = {}
) {
  const lastId = await getLastMessageId(chatId);
  if (lastId) {
    try {
      // BUGFIX: второй аргумент должен быть number, НЕ string
      await bot.deleteMessage(chatId, lastId as unknown as number);
    } catch (err: any) {
      const msg = String(err?.response?.body?.description ?? err?.message ?? err);
      // Типовые ошибки игнорируем (сообщение уже удалено/слишком старое и т.п.)
      if (!/message to delete not found|message can't be deleted/i.test(msg)) {
        log.debug({ err: msg }, 'SLM: delete previous failed (ignored)');
      }
    }
  }

  const sent = await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...opts,
  });

  await setLastMessageId(chatId, sent.message_id);
  return sent;
}

/**
 * Редактировать экран из callback.
 * - Если kb не передали — используем текущую клавиатуру сообщения (не даём кнопкам пропасть).
 * - При УСПЕХЕ редактирования — помечаем этот message_id как актуальный SLM (чтобы дальше не плодить дубли).
 * - При НЕУДАЧЕ — шлём новый экран (он и станет SLM).
 */
export async function editOrReplaceFromCallback(
  bot: TelegramBot,
  cb: TelegramBot.CallbackQuery,
  text: string,
  kb?: InlineKeyboardMarkup
) {
  if (!cb.message) return;
  const chatId = cb.message.chat.id as number;
  const msgId = cb.message.message_id as number;

  const currentKb = (cb.message as any)?.reply_markup as InlineKeyboardMarkup | undefined;
  const effectiveKb = kb ?? currentKb;

  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: effectiveKb,
    } as EditMessageTextOptions);

    // Помечаем отредактированное сообщение как актуальное SLM
    await setLastMessageId(chatId, msgId);
    return;
  } catch (err: any) {
    const msg = String(err?.response?.body?.description ?? err?.message ?? err);
    if (/message is not modified/i.test(msg)) {
      await setLastMessageId(chatId, msgId);
      return;
    }
    // Фоллбэк: отправляем новый SLM-экран
    await showScreen(bot, chatId, text, { reply_markup: effectiveKb });
  }
}

/**
 * Обновить текущий экран по chatId.
 * Если kb не передали — редактируем как есть; при фоллбэке showScreen уже запомнит новый id.
 */
export async function updateScreen(
  bot: TelegramBot,
  chatId: number,
  text: string,
  kb?: InlineKeyboardMarkup
) {
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
    await setLastMessageId(chatId, lastId);
  } catch (err: any) {
    const msg = String(err?.response?.body?.description ?? err?.message ?? err);
    if (/message is not modified/i.test(msg)) return;
    await showScreen(bot, chatId, text, { reply_markup: kb });
  }
}
