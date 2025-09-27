// src/ui/text.ts
// Все тексты и клавиатуры бота (INLINE). Русские комменты внутри.

import type { InlineKeyboardMarkup } from 'node-telegram-bot-api';

// ===== Общие типы =====
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

// ===== Кнопка “Назад” =====
export function backOnlyKeyboard(): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: '← Назад', callback_data: 'menu:back' }]] };
}

// ===== Онбординг =====
export function askLoginText(): string {
  return (
    `<b>Придумай логин</b>\n\n` +
    `Напиши свой логин (до 32 символов).`
  );
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

// ===== Настройки =====
export function settingsText(p: { mode: Mode; pollHour: number; login?: string }): string {
  const modeLabel = p.mode === 'zozh' ? 'ЗОЖник 🌿' : 'Алкоголик 🍻';
  return (
    `<b>Настройки</b>\n\n` +
    (p.login ? `Логин: <code>${escapeHtml(p.login)}</code>\n` : ``) +
    `Режим: <b>${modeLabel}</b>\n` +
    `Час опроса: <b>${p.pollHour}:00</b>\n\n` +
    `Нажми на нужный параметр, чтобы изменить.`
  );
}

export function settingsKeyboard(p: { mode: Mode; pollHour: number }): InlineKeyboardMarkup {
  const hourButtons = [18, 19, 20, 21, 22].map((h) => ({
    text: `${h}:00` + (h === p.pollHour ? ' ✅' : ''),
    callback_data: `settings:poll_hour:${h}`,
  }));
  return {
    inline_keyboard: [
      [
        { text: (p.mode === 'zozh' ? '🌿 ЗОЖник ✅' : '🌿 ЗОЖник'), callback_data: 'mode:zozh' },
        { text: (p.mode === 'alco' ? '🍻 Алкоголик ✅' : '🍻 Алкоголик'), callback_data: 'mode:alco' },
      ],
      hourButtons,
      [{ text: '← В меню', callback_data: 'menu:back' }],
    ],
  };
}

// ===== Опрос “Сегодня пил?” =====
export function todayPollText(): string {
  return `<b>Сегодня пил?</b>`;
}

export function todayPollKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: 'Да', callback_data: 'poll:answer:yes' },
      { text: 'Нет', callback_data: 'poll:answer:no' },
    ],
    [{ text: '← В меню', callback_data: 'menu:back' }]],
  };
}

// ===== Выбор напитка =====
export function chooseDrinkText(): string {
  return `<b>Что именно пил?</b>`;
}

// Ожидаем массив активных напитков вида { id, name }
export function chooseDrinkKeyboard(drinks: Array<{ id: number; name: string }>): InlineKeyboardMarkup {
  const rows: { text: string; callback_data: string }[][] = [];
  for (const d of drinks) {
    rows.push([{ text: d.name, callback_data: `poll:drink:${d.id}` }]);
  }
  rows.push([
    { text: '← Назад (Да/Нет)', callback_data: 'poll:back_to_yesno' },
    { text: '← В меню', callback_data: 'menu:back' },
  ]);
  return { inline_keyboard: rows };
}

// ===== Выбор количества =====
export function chooseAmountText(drinkName: string): string {
  return `<b>${escapeHtml(drinkName)}</b>\nВыбери количество (условные порции):`;
}

// Примерно: 1,2,3,4,5 + назад
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

// ===== Утилиты =====
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
