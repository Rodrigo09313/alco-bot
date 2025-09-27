// Все тексты и клавиатуры бота (INLINE).
// Централизация: сюда вынесены ВСЕ строки интерфейса и клавиатуры, включая админку и статусы.

import type { InlineKeyboardMarkup } from 'node-telegram-bot-api';
import type { LeaderRow } from '../db/leaderboardRepo.js';

export type Mode = 'zozh' | 'alco';

// ===== Главное меню =====
export function mainMenuText(): string {
  return (
    `<b>AlcoCheck</b>\n\n` +
    `Ежедневно фиксируем: пил/не пил.\n` +
    `Статистика, серии, мотивация.`
  );
}
export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📊 Профиль', callback_data: 'menu:profile' },
        { text: '⚙️ Настройки', callback_data: 'menu:settings' },
      ],
      [
        { text: '🏆 Лидеры', callback_data: 'menu:leaderboard' },
        { text: '🍷 Сегодня пил?', callback_data: 'poll:manual' },
      ],
    ],
  };
}

// ===== Универсальные "назад" / навигация =====
export function backOnlyKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: '← В меню', callback_data: 'menu:back' }]] };
}
export function backToProfileKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: '← К профилю', callback_data: 'menu:profile' }]] };
}
export function toMenuKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: '← В меню', callback_data: 'menu:back' }]] };
}
export function needStartText(): string { return 'Сначала /start'; }
export function emptyTextError(): string { return 'Текст пуст. Пришли вопрос строкой.'; }

// ===== Онбординг =====
export function askLoginText(): string {
  return `<b>Придумай логин</b>\n\nНапиши свой логин (до 32 символов).`;
}
export function chooseModeText(): string {
  return (
    `<b>Выбери режим</b>\n\n` +
    `• <b>ЗОЖник</b> — цель держать серию трезвых дней.\n` +
    `• <b>Алкоголик</b> — честно фиксируем каждый случай.`
  );
}
export function chooseModeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: '🌿 ЗОЖник', callback_data: 'mode:zozh' },
      { text: '🍻 Алкоголик', callback_data: 'mode:alco' },
    ]],
  };
}

// ===== Настройки (корень + подменю) =====
export type SettingsMode = Mode;
export function settingsRootText(p: { mode: Mode; pollHour: number; login?: string }): string {
  const modeLabel = p.mode === 'zozh' ? 'ЗОЖник 🌿' : 'Алкоголик 🍻';
  return (
    `<b>Настройки</b>\n\n` +
    (p.login ? `Логин: <code>${escapeHtml(p.login)}</code>\n` : ``) +
    `Текущий режим: <b>${modeLabel}</b>\n` +
    `Час уведомлений (МСК): <b>${pad2(p.pollHour)}:00</b>\n\n` +
    `Выбери, что настроить:`
  );
}
export function settingsRootKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🧭 Режим', callback_data: 'settings:mode' }],
      [{ text: '⏰ Время уведомлений (МСК)', callback_data: 'settings:time' }],
      [{ text: '← В меню', callback_data: 'menu:back' }],
    ],
  };
}
export function settingsModeText(): string {
  return `<b>Режим</b>\n\nВыбери пресет поведения:`;
}
export function settingsModeKeyboard(p: { mode: Mode }): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: p.mode === 'zozh' ? '🌿 ЗОЖник ✅' : '🌿 ЗОЖник', callback_data: 'mode:zozh' },
        { text: p.mode === 'alco' ? '🍻 Алкоголик ✅' : '🍻 Алкоголик', callback_data: 'mode:alco' },
      ],
      [{ text: '← Назад', callback_data: 'settings:back' }],
    ],
  };
}
export function settingsTimeText(): string {
  return `<b>Время уведомлений</b>\n\nВыбери час (МСК):`;
}
export function settingsTimeKeyboard(p: { pollHour: number }): InlineKeyboardMarkup {
  const hours = [18, 19, 20, 21, 22, 23];
  const row = hours.map((h) => ({
    text: `${pad2(h)}:00` + (h === p.pollHour ? ' ✅' : ''),
    callback_data: `settings:poll_hour:${h}`,
  }));
  return {
    inline_keyboard: [
      row.slice(0, 3),
      row.slice(3),
      [{ text: '← Назад', callback_data: 'settings:back' }],
    ],
  };
}

// ===== Профиль (суммарный блок) =====
export function profileSummaryText(p: {
  login?: string;
  mode: Mode;
  soberCurrent: number; soberBest: number;
  drunkCurrent: number; drunkBest: number;
  soberDays: number; drunkDays: number; soberPct: number;
}): string {
  const modeLabel = p.mode === 'zozh' ? 'ЗОЖник 🌿' : 'Алкоголик 🍻';
  const bar = progressBar(p.soberPct, 12);
  return (
    `<b>Профиль</b>\n` +
    (p.login ? `Логин: <code>${escapeHtml(p.login)}</code>\n` : ``) +
    `Режим: <b>${modeLabel}</b>\n\n` +
    `<b>Серии</b>\n` +
    `• Трезвая: текущая <b>${p.soberCurrent}</b>, лучшая <b>${p.soberBest}</b>\n` +
    `• Пьяная:  текущая <b>${p.drunkCurrent}</b>, лучшая <b>${p.drunkBest}</b>\n\n` +
    `<b>Дни</b>\n` +
    `• Трезвых: <b>${p.soberDays}</b>\n` +
    `• Пьяных:  <b>${p.drunkDays}</b>\n` +
    `• Доля трезвых: <b>${p.soberPct}%</b> ${bar}`
  );
}
export function profileKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🎯 Мои цели', callback_data: 'profile:goals' }],
      [{ text: '← В меню', callback_data: 'menu:back' }],
    ],
  };
}

// ===== Опросы =====
export function todayPollText(question?: string): string {
  return `<b>${escapeHtml(question ?? 'Сегодня пил?')}</b>`;
}
export function todayPollKeyboard(pollId?: number): InlineKeyboardMarkup {
  const id = pollId != null ? `:${pollId}` : '';
  return {
    inline_keyboard: [
      [
        { text: 'Да',  callback_data: `poll:answer:yes${id}` },
        { text: 'Нет', callback_data: `poll:answer:no${id}`  },
      ],
      [{ text: '← В меню', callback_data: 'menu:back' }],
    ],
  };
}
export function chooseDrinkText(): string { return `<b>Что именно пил?</b>`; }
export function chooseDrinkKeyboard(drinks: Array<{ id: number; name: string }>): InlineKeyboardMarkup {
  const rows: { text: string; callback_data: string }[][] = [];
  for (const d of drinks) rows.push([{ text: d.name, callback_data: `poll:drink:${d.id}` }]);
  rows.push([
    { text: '← Назад (Да/Нет)', callback_data: 'poll:back_to_yesno' },
    { text: '← В меню', callback_data: 'menu:back' },
  ]);
  return { inline_keyboard: rows };
}
export function chooseAmountText(drinkName: string): string {
  return `<b>${escapeHtml(drinkName)}</b>\nВыбери количество (условные порции):`;
}
export function chooseAmountKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '1', callback_data: 'poll:amount:1' },
        { text: '2', callback_data: 'poll:amount:2' },
        { text: '3', callback_data: 'poll:amount:3' },
      ],
      [
        { text: '4', callback_data: 'poll:amount:4' },
        { text: '5', callback_data: 'poll:amount:5' },
      ],
      [
        { text: '← К напиткам', callback_data: 'poll:back_to_drinks' },
        { text: '← В меню', callback_data: 'menu:back' },
      ],
    ],
  };
}

// ===== Лидеры =====
export function leaderboardText(p: { rows: LeaderRow[]; page: number; total: number; pageSize: number }): string {
  const { rows, page, total, pageSize } = p;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const header = `<b>🏆 Лидеры</b>  <i>страница ${page}/${pages}</i>\n\n` +
                 `<i>Сортировка: текущая трезвая серия ↓, затем лучшая серия ↓, затем % трезвых за 30д ↓</i>\n\n`;

  if (rows.length === 0) return header + `Пока пусто.`;

  const lines = rows.map(r => {
    const left = `<b>#${r.rank}</b>  ${escapeHtml(r.name)}`;
    const right = `серия: <b>${r.sober_current}</b> (best ${r.sober_best})  |  30д: <b>${r.sober30}/${r.drunk30}</b>  (${r.sober_pct30}%)  |  порций: <b>${r.portions30}</b>`;
    return `${left}\n${right}`;
  }).join(`\n\n`);

  return header + lines;
}
export function leaderboardKeyboard(p: { page: number; total: number; pageSize: number }): InlineKeyboardMarkup {
  const { page, total, pageSize } = p;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prev = Math.max(1, page - 1);
  const next = Math.min(pages, page + 1);

  const navRow: { text: string; callback_data: string }[] = [];
  navRow.push({ text: '← В меню', callback_data: 'menu:back' });
  if (pages > 1) {
    navRow.push({ text: '« Пред', callback_data: `leaderboard:page:${prev}` });
    navRow.push({ text: 'След »', callback_data: `leaderboard:page:${next}` });
  }

  return { inline_keyboard: [navRow] };
}

// ===== Админка / статусы =====
export function adminText(): string {
  return `<b>Админ-панель</b>\nДоступно:\n• Опросить всех\n• Опросить по текущему часу (МСК)\n• Крафтовый опрос (ручной вопрос)`;
}
export function adminKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🚨 Опросить всех сейчас', callback_data: 'admin:poll_all' }],
      [{ text: '🕐 Опросить по текущему часу (МСК)', callback_data: 'admin:poll_hour' }],
      [{ text: '🧪 Крафтовый опрос', callback_data: 'admin:craft' }],
      [{ text: '← В меню', callback_data: 'menu:back' }],
    ],
  };
}
export function craftPromptText(): string {
  return `<b>Крафтовый опрос</b>\n\nПришли ТЕКСТ вопроса одним сообщением.\nВсем пользователям уйдёт «Да/Нет», ответы сохранятся.`;
}
export function craftResultText(ok: number, total: number, fail: number): string {
  return `✅ Крафтовый опрос разослан.\nOK: <b>${ok}</b> / ${total}\nОшибок: <b>${fail}</b>`;
}
export function pollAllResultText(ok: number, total: number, fail: number): string {
  return `✅ Опрос для всех.\nOK: <b>${ok}</b> / ${total}\nОшибок: <b>${fail}</b>`;
}
export function pollHourResultText(hour: number, ok: number, total: number, fail: number): string {
  return `✅ Опрос по часу (МСК ${String(hour).padStart(2,'0')}:00).\nOK: <b>${ok}</b> / ${total}\nОшибок: <b>${fail}</b>`;
}

// ===== Утилиты =====
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function progressBar(pct: number, width = 10): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round((p / 100) * width);
  return '▮'.repeat(filled) + '▯'.repeat(Math.max(0, width - filled));
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
