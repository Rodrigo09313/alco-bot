import { InlineKeyboardMarkup } from 'node-telegram-bot-api';

export function mainMenuText() {
  return `<b>Главное меню</b>\n\nВыбирай действие кнопками ниже.`;
}

export function mainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🏆 Лидеры', callback_data: 'menu:leaderboard' }],
      [{ text: '👤 Профиль', callback_data: 'menu:profile' }],
      [{ text: '⚙️ Настройки', callback_data: 'menu:settings' }],
    ],
  };
}

export function chooseModeText() {
  return `<b>Выбор режима</b>\n\nКто ты сегодня?\n• ЗОЖник 🌿 — учитываем трезвые серии\n• Алкоголик 🤪 — считаем дринки и рекорды`;
}

export function chooseModeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: 'ЗОЖник 🌿', callback_data: 'mode:zozh' }],
      [{ text: 'Алкоголик 🤪', callback_data: 'mode:alco' }],
    ],
  };
}

export function askLoginText() {
  return `<b>Регистрация</b>\n\nВведи логин (отображаемое имя):`;
}
