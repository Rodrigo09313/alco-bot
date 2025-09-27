// SLM (Single Live Message): одно "живое" сообщение на чат.
// Безопасное редактирование: никогда не теряем клавиатуру (reply_markup).

import TelegramBot, {
  SendMessageOptions,
  EditMessageTextOptions,
  InlineKeyboardMarkup,
} from 'node-telegram-bot-api';
import { getRedis } from '../lib/redis.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger(process.env.LOG_LEVEL);
const r = getRedis();

function key(chatId: number | string) {
  return `slm:${chatId}`;
}

export async function getLastMessageId(chatId: number): Promise<number | null> {
  const v = await r.get(key(chatId));
  return v ? Number(v) : null;
}

async function setLastMessageId(chatId: number, messageId: number) {
  await r.set(key(chatId), String(messageId));
}

export async function clearLastMessage(chatId: number) {
  await r.del(key(chatId));
}

function normalizeKb(kb?: InlineKeyboardMarkup | any): InlineKeyboardMarkup | undefined {
  if (kb && kb.reply_markup && !kb.inline_keyboard && kb.reply_markup.inline_keyboard) {
    return kb.reply_markup as InlineKeyboardMarkup;
  }
  return kb as InlineKeyboardMarkup | undefined;
}

export async function showScreen(
  bot: TelegramBot,
  chatId: number,
  text: string,
  opts: Omit<SendMessageOptions, 'chat_id'> = {}
) {
  const lastId = await getLastMessageId(chatId);
  if (lastId) {
    try {
      await bot.deleteMessage(chatId, String(lastId));
    } catch (err: any) {
      const msg = String(err?.response?.body?.description ?? err?.message ?? err);
      if (!/message to delete not found|message can't be deleted/i.test(msg)) {
        log.debug({ err: msg }, 'SLM: delete previous failed (ignored)');
      }
    }
  }

  const sent = await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(opts.reply_markup ? { reply_markup: normalizeKb(opts.reply_markup as any) } : {}),
    ...opts,
  });

  await setLastMessageId(chatId, sent.message_id);
  return sent;
}

export async function editOrReplaceFromCallback(
  bot: TelegramBot,
  cb: TelegramBot.CallbackQuery,
  text: string,
  kb?: InlineKeyboardMarkup
) {
  if (!cb.message) return;
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;

  const currentKb = (cb.message as any)?.reply_markup as InlineKeyboardMarkup | undefined;
  const effectiveKb = normalizeKb(kb ?? currentKb);

  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: effectiveKb,
    } as EditMessageTextOptions);

    await setLastMessageId(chatId, msgId);
    return;
  } catch (err: any) {
    const msg = String(err?.response?.body?.description ?? err?.message ?? err);
    if (/message is not modified/i.test(msg)) {
      await setLastMessageId(chatId, msgId);
      return;
    }
    await showScreen(bot, chatId, text, { reply_markup: effectiveKb });
  }
}

export async function updateScreen(
  bot: TelegramBot,
  chatId: number,
  text: string,
  kb?: InlineKeyboardMarkup
) {
  const lastId = await getLastMessageId(chatId);
  if (!lastId) {
    await showScreen(bot, chatId, text, { reply_markup: normalizeKb(kb) });
    return;
  }
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: lastId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: normalizeKb(kb),
    } as EditMessageTextOptions);
    await setLastMessageId(chatId, lastId);
  } catch (err: any) {
    const msg = String(err?.response?.body?.description ?? err?.message ?? err);
    if (/message is not modified/i.test(msg)) return;
    await showScreen(bot, chatId, text, { reply_markup: normalizeKb(kb) });
  }
}
