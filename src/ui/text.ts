// Все тексты и клавиатуры бота (INLINE).
// Централизация: сюда вынесены ВСЕ строки интерфейса и клавиатуры, включая админку и статусы.

import type { InlineKeyboardMarkup } from 'node-telegram-bot-api';
import type { LeaderRow, LeaderboardType } from '../db/leaderboardRepo.js';

export type Mode = 'zozh' | 'alco';

// ===== Эмодзи и стили =====
const EMOJI = {
  PROFILE: '👤',
  SETTINGS: '⚙️',
  LEADERBOARD: '🏆',
  POLL: '🎯',
  BACK: '↩️',
  HOME: '🏠',
  ZOZH: '🌿',
  ALCO: '🍷',
  STATS: '📊',
  GOALS: '🎯',
  CALENDAR: '📅',
  TROPHY: '🏆',
  FIRE: '🔥',
  CHART: '📈',
  CHECK: '✅',
  EDIT: '✏️',
  CLOCK: '⏰',
  PARTY: '🎉',
  SAD: '😔',
  HAPPY: '😊',
  CROWN: '👑',
  ROCKET: '🚀',
  STAR: '⭐',
  HEART: '💚',
  WARNING: '⚠️',
  BEER: '🍺',
  WINE: '🍷',
  COCKTAIL: '🍸',
  TADA: '🎊',
  MEDAL: '🏅',
  GRAPH: '📊',
  BULLET: '▫️',
  ZAP: '⚡',
  CELEBRATE: '🎈',
  TROPHY_CUP: '🏆',
  GROWING: '🌱',
  COMET: '☄️',
  DIAMOND: '💎',
  INFINITY: '♾️',
  LIGHTNING: '🌩️',
  SUN: '☀️',
  RAINBOW: '🌈',
  GALAXY: '🌌',
  FILTER: '🔍',
  SORT: '📊',
  TARGET: '🎯',
  ACTIVITY: '⚡',
  TROPHY_STAR: '⭐',
  FIRE_WORK: '🎇',
  MILESTONE: '🪙',
  CHAMPION: '💪',
  LEGEND: '🧙',
  SUPERHERO: '🦸',
  KING: '🤴',
  GOD: '👼',
  UNICORN: '🦄',
  DRAGON: '🐲',
  PHOENIX: '🔥',
  WIZARD: '🧙‍♂️',
  NINJA: '🥷',
  ASTRONAUT: '👨‍🚀',
  DETECTIVE: '🕵️',
  GUARDIAN: '💂',
  WARRIOR: '⚔️',
  GENIUS: '🧠',
  MAGICIAN: '🎩'
} as const;

// ===== Расширенная система достижений =====
const EXTENDED_MILESTONES = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 240, 270, 300, 330, 365, 500, 730, 1000];

// Система уровней и бейджей
const LEVEL_SYSTEM = [
  { level: 1, badge: '🐣', name: 'Новичок', threshold: 0 },
  { level: 2, badge: '🌱', name: 'Ученик', threshold: 3 },
  { level: 3, badge: '🚀', name: 'Стратер', threshold: 7 },
  { level: 4, badge: '⭐', name: 'Профи', threshold: 14 },
  { level: 5, badge: '🏆', name: 'Чемпион', threshold: 30 },
  { level: 6, badge: '💎', name: 'Мастер', threshold: 60 },
  { level: 7, badge: '🐉', name: 'Легенда', threshold: 90 },
  { level: 8, badge: '🧙', name: 'Мудрец', threshold: 180 },
  { level: 9, badge: '🦸', name: 'Герой', threshold: 365 },
  { level: 10, badge: '👑', name: 'Бог', threshold: 730 }
];

const MODE_TEXTS = {
  zozh: {
    name: 'ЗОЖник',
    emoji: '🌿',
    poll: {
      question: "Держишь уровень? 💪",
      yes: ["💔 Сорвался", "😔 Маленький шаг назад", "⚡️ Перезагрузка!", "🔄 Начинаем заново"],
      no: ["🔥 В теме!", "💪 Железно!", "🚀 Летишь!", "⭐️ Идеально!"]
    },
    streaks: {
      sober: "💪 Серия чистоты",
      drunk: "😴 Перерывчик"
    },
    achievements: {
      1: ["🎯 Первый день! Ты стартанул!", "🚀 Начало пути! Гордись собой!", "💫 День 1 - уже победа!"],
      2: ["🔰 Второй день! Движемся дальше!", "🌱 Закрепляешь успех! Так держать!", "⚡️ Уже не новичок!"],
      3: ["🎊 Три дня! Первый рубеж пройден!", "💪 Входишь в ритм! Красава!", "🌟 Уже привыкаешь к успеху!"],
      4: ["🌈 Четыре дня! Уверенное движение!", "🚀 Набираешь обороты!", "⭐️ Почти неделя!"],
      5: ["🔥 Пять дней! Полнедели чистоты!", "💎 Уверенный старт!", "🌟 Отличный темп!"],
      6: ["⚡ Шесть дней! Завтра неделя!", "🎯 Почти у цели!", "💪 Не сбавляй!"],
      7: ["🎉 НЕДЕЛЯ! Ты просто машина!", "🏆 7 дней без бухла - это сила!", "💎 Железная воля! Так держать!"],
      10: ["🔥 ДЕСЯТКА! Ты вошел в поток!", "⚡️ 10 дней - это уже система!", "🌟 Десять шагов к успеху!"],
      14: ["💫 ДВЕ НЕДЕЛИ! Невероятно!", "🌈 14 дней чистоты - ты крут!", "🎯 Уверенное движение вперед!"],
      21: ["🚀 ТРИ НЕДЕЛИ! Ты железный!", "💪 21 день - это уже привычка!", "⭐️ Месяц на подходе!"],
      30: ["🎊 МЕСЯЦ! Ты абсолютная легенда!", "👑 30 дней трезвости - это мощно!", "🌈 Целый месяц побед!"],
      40: ["💎 40 дней! Непревзойденно!", "🐉 Уровень мастера!", "🌟 Феноменальная сила воли!"],
      50: ["🏆 50 дней! Полсотни побед!", "🧙 Мудрое решение каждый день!", "⚡️ Полпути к сотке!"],
      60: ["🌈 60 дней! Два месяца силы!", "🚀 Космический уровень!", "⭐️ Истинная дисциплина!"],
      70: ["🔥 70 дней! Новый рубеж!", "💪 Стальной характер!", "🌟 Пример для подражания!"],
      80: ["🎯 80 дней! Неудержим!", "🏆 Настоящий чемпион!", "💎 Алмазная воля!"],
      90: ["🐉 90 дней! Квартал побед!", "🧙‍♂️ Мудрец трезвости!", "⚡️ Три месяца силы!"],
      100: ["🎊 СОТКА! Ты настоящий монстр!", "👑 100 дней - король дисциплины!", "💫 Век чистоты!"],
      120: ["🚀 120 дней! Невероятно!", "🌈 Четыре месяца побед!", "⭐️ Легенда живет среди нас!"],
      150: ["💎 150 дней! Полгода силы!", "🐲 Дракон воли!", "🌟 Абсолютный контроль!"],
      180: ["🏆 ПОЛГОДА! Мастер дисциплины!", "🧙‍♀️ Верховный мудрец!", "⚡️ 180 дней мощи!"],
      200: ["🎯 200 дней! Эпический результат!", "👑 Император трезвости!", "💫 Две сотни побед!"],
      240: ["🌈 240 дней! 8 месяцев силы!", "🚀 Космический рекорд!", "⭐️ Небесный уровень!"],
      270: ["🔥 270 дней! 9 месяцев!", "💎 Алмазный характер!", "🌟 Феномен!"],
      300: ["🎊 300 дней! Десять месяцев!", "🐉 Титан воли!", "⚡️ Электрическая дисциплина!"],
      330: ["🏆 330 дней! Почти год!", "🧙‍♂️ Верховный маг!", "💫 Практически бог!"],
      365: ["👑 ГОД! Ты феноменальный!", "🎊 365 дней - это легендарно!", "💎 Целый год силы воли!"]
    },
    dailyReminder: "🔥 Не прерви свою трезвую серию! Держишься?"
  },
  alco: {
    name: 'Алкоголик', 
    emoji: '🍷',
    poll: {
      question: "Чё по бухлу? 🍻",
      yes: ["🎉 Бухнул!", "🍺 Культурно отдыхаю!", "🥃 В системе!", "🍷 Процесс пошел!"],
      no: ["🤨 Трезвяк?", "😴 Скучно...", "💤 Тишина", "🌚 Сухостой"]
    },
    streaks: {
      sober: "🍻 Завязка",
      drunk: "🎊 Культурные выходные" 
    },
    achievements: {
      1: ["🎯 Разок бухнул - культурно!", "🍷 День в системе! Начинаем отсчет!", "💫 Первая отметка!"],
      2: ["🔰 Два дня подряд - уже система!", "🍺 Входишь в ритм! Процесс пошел!", "⚡️ Заряжаемся!"],
      3: ["🎊 Тройка бухла! Запойный мастер!", "🥃 Три дня - системный подход!", "🌟 Набираем обороты!"],
      4: ["🌈 Четыре дня! Опытный тусовщик!", "🍷 Настоящий ценитель!", "⭐️ Почти неделя веселья!"],
      5: ["🔥 Пять дней! Полнедели кайфа!", "💎 Опытный дегустатор!", "🌟 Отличный темп!"],
      6: ["⚡ Шесть дней! Завтра неделя!", "🎯 Почти у цели!", "💪 Не сбавляй!"],
      7: ["🎉 НЕДЕЛЯ В РЕЖИМЕ! Профи бухла!", "🏆 7 дней - мастер дегустации!", "💎 Неделя удовольствия!"],
      10: ["🔥 ДЕСЯТКА! Ты в теме!", "⚡️ 10 дней - настоящий знаток!", "🌟 Десять дней гедонизма!"],
      14: ["💫 ДВЕ НЕДЕЛИ! Настоящий ценитель!", "🌈 14 дней - уровень сомелье!", "🎯 Две недели наслаждения!"],
      21: ["🚀 ТРИ НЕДЕЛИ! Гуру алкоголизма!", "💪 21 день - виртуоз бухла!", "⭐️ Месяц на горизонте!"],
      30: ["🎊 МЕСЯЦ! Виночерпий уровня бог!", "👑 30 дней в системе - красава!", "🌈 Целый месяц гедонизма!"],
      40: ["💎 40 дней! Мастер вечеринок!", "🐉 Уровень профессионала!", "🌟 Истинный гедонист!"],
      50: ["🏆 50 дней! Полсотни тусовок!", "🧙 Мудрец возлияний!", "⚡️ Полпути к сотке!"],
      60: ["🌈 60 дней! Два месяца кайфа!", "🚀 Космический уровень веселья!", "⭐️ Мастер наслаждения!"],
      70: ["🔥 70 дней! Новый рубеж!", "💪 Ветеран тусовок!", "🌟 Легенда ночной жизни!"],
      80: ["🎯 80 дней! Неудержимый весельчак!", "🏆 Настоящий чемпион!", "💎 Алмазный тусовщик!"],
      90: ["🐉 90 дней! Квартал наслаждений!", "🧙‍♂️ Мудрец гедонизма!", "⚡️ Три месяца веселья!"],
      100: ["🎊 СОТКА БУХЛА! Абсолютный чемпион!", "👑 100 дней - король вечеринок!", "💫 Век веселья!"],
      120: ["🚀 120 дней! Невероятный марафон!", "🌈 Четыре месяца кайфа!", "⭐️ Икона тусовок!"],
      150: ["💎 150 дней! Полгода веселья!", "🐲 Дракон вечеринок!", "🌟 Абсолютный гедонист!"],
      180: ["🏆 ПОЛГОДА! Мастер вечеринок!", "🧙‍♀️ Верховная жрица наслаждений!", "⚡️ 180 дней кайфа!"],
      200: ["🎯 200 дней! Эпический марафон!", "👑 Император алкокультуры!", "💫 Две сотни вечеринок!"],
      240: ["🌈 240 дней! 8 месяцев веселья!", "🚀 Космический рекорд тусовок!", "⭐️ Небесный уровень!"],
      270: ["🔥 270 дней! 9 месяцев кайфа!", "💎 Алмазный весельчак!", "🌟 Феномен гедонизма!"],
      300: ["🎊 300 дней! Десять месяцев!", "🐉 Титан вечеринок!", "⚡️ Электрическое веселье!"],
      330: ["🏆 330 дней! Почти год!", "🧙‍♂️ Верховный маг тусовок!", "💫 Практически бог!"],
      365: ["👑 ГОД! Король тусовок!", "🎊 365 дней - легенда ночной жизни!", "💎 Год удовольствия!"]
    },
    dailyReminder: "📊 Время для честной отметки! Как дела с бухлом?"
  }
};

// Конфигурация типов лидерборда
const LEADERBOARD_TYPES: Record<LeaderboardType, { emoji: string; name: string; description: string }> = {
  current: { emoji: '🔥', name: 'Текущая серия', description: 'Сортировка по текущей трезвой серии' },
  best: { emoji: '🏆', name: 'Лучшая серия', description: 'Сортировка по рекордной серии' },
  percentage: { emoji: '📈', name: 'Процент трезвости', description: 'Сортировка по % трезвых дней за 30д' },
  activity: { emoji: '⚡', name: 'Активность', description: 'Сортировка по количеству дней с ответами' }
};

// Утилиты для работы с режимами
function getRandomText(texts: string[]): string {
  return texts[Math.floor(Math.random() * texts.length)];
}

function getModeTexts(mode: Mode) {
  return MODE_TEXTS[mode];
}

export function getAchievementMessage(mode: Mode, days: number): string | null {
  const texts = getModeTexts(mode).achievements;
  const dayKey = days as keyof typeof texts;
  if (texts[dayKey]) {
    return getRandomText(texts[dayKey]);
  }
  return null;
}

// Система уровней
export function getUserLevelInfo(days: number): { level: number; badge: string; name: string; progress: number; nextLevel: number } {
  for (let i = LEVEL_SYSTEM.length - 1; i >= 0; i--) {
    if (days >= LEVEL_SYSTEM[i].threshold) {
      const currentLevel = LEVEL_SYSTEM[i];
      const nextLevel = LEVEL_SYSTEM[i + 1];
      const progress = nextLevel 
        ? Math.round(((days - currentLevel.threshold) / (nextLevel.threshold - currentLevel.threshold)) * 100)
        : 100;
      
      return {
        level: currentLevel.level,
        badge: currentLevel.badge,
        name: currentLevel.name,
        progress: Math.min(100, progress),
        nextLevel: nextLevel?.threshold || 0
      };
    }
  }
  
  return {
    level: 1,
    badge: '🐣',
    name: 'Новичок',
    progress: 0,
    nextLevel: 3
  };
}

// ===== Главное меню =====
export function mainMenuText(mode: Mode = 'zozh'): string {
  const config = getModeTexts(mode);
  return (
    `✨ <b>AlcoCheck</b> — ${config.name} режим ${config.emoji}\n\n` +
    `${EMOJI.CALENDAR} <i>Ежедневные отметки • Персональная статистика • Мотивационные цели</i>\n\n` +
    `${EMOJI.HEART} <b>${mode === 'zozh' ? 'Ставь рекорды!' : 'Честная статистика без осуждения!'}</b>`
  );
}

export function mainMenuKeyboard(mode: Mode = 'zozh'): InlineKeyboardMarkup {
  const config = getModeTexts(mode);
  const pollButtonText = mode === 'zozh' ? 'Отметить день' : 'Чё по бухлу?';
  
  return {
    inline_keyboard: [
      [
        { text: `${EMOJI.PROFILE} Мой профиль`, callback_data: 'menu:profile' },
        { text: `${EMOJI.SETTINGS} Настройки`, callback_data: 'menu:settings' },
      ],
      [
        { text: `${EMOJI.LEADERBOARD} Топ игроков`, callback_data: 'menu:leaderboard' },
        { text: `${config.emoji} ${pollButtonText}`, callback_data: 'poll:manual' },
      ],
    ],
  };
}

// ===== Универсальные "назад" / навигация =====
export function backOnlyKeyboard(): InlineKeyboardMarkup {
  return { 
    inline_keyboard: [[{ text: `${EMOJI.BACK} В главное меню`, callback_data: 'menu:back' }]] 
  };
}

export function backToProfileKeyboard(): InlineKeyboardMarkup {
  return { 
    inline_keyboard: [[{ text: `${EMOJI.BACK} К профилю`, callback_data: 'menu:profile' }]] 
  };
}

export function toMenuKeyboard(): InlineKeyboardMarkup {
  return { 
    inline_keyboard: [[{ text: `${EMOJI.HOME} В меню`, callback_data: 'menu:back' }]] 
  };
}

export function needStartText(): string { 
  return `${EMOJI.WARNING} <b>Давай начнем!</b>\n\nОтправь команду /start чтобы активировать бота.`; 
}

export function emptyTextError(): string { 
  return `${EMOJI.WARNING} <b>Ой, пусто!</b>\n\nПришли вопрос текстовым сообщением.`; 
}

// ===== Онбординг =====
export function askLoginText(): string {
  return (
    `🎭 <b>Создай свой уникальный логин</b>\n\n` +
    `Придумай запоминающееся имя (до 32 символов)\n\n` +
    `<code>💡 Примеры: sober_warrior, clear_mind, new_me_2024</code>`
  );
}

export function chooseModeText(): string {
  return (
    `🛣️ <b>Выбери свой путь к осознанности</b>\n\n` +
    `${EMOJI.BULLET} <b>${EMOJI.ZOZH} Путь ЗОЖника</b> — ставь рекорды трезвости, строй впечатляющие серии!\n` +
    `${EMOJI.BULLET} <b>${EMOJI.ALCO} Режим Алкоголика</b> — честная статистика без осуждения\n\n` +
    `${EMOJI.HEART} <i>Ты всегда можешь изменить выбор в настройках</i>`
  );
}

export function chooseModeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: `${EMOJI.ZOZH} Стать ЗОЖником`, callback_data: 'mode:zozh' },
      { text: `${EMOJI.ALCO} Быть Алкоголиком`, callback_data: 'mode:alco' },
    ]],
  };
}

// ===== Настройки (корень + подменю) =====
export type SettingsMode = Mode;

export function settingsRootText(p: { mode: Mode; pollHour: number; login?: string }): string {
  const config = getModeTexts(p.mode);
  const motivation = p.mode === 'zozh' 
    ? `${EMOJI.ROCKET} Ты на пути к рекордам!` 
    : `${EMOJI.HEART} Честность — твоя суперсила!`;

  return (
    `⚙️ <b>Персональные настройки</b>\n\n` +
    `${EMOJI.EDIT} <b>Логин:</b> <code>${escapeHtml(p.login || 'Анонимный герой')}</code>\n` +
    `${config.emoji} <b>Режим:</b> ${config.name}\n` +
    `${EMOJI.CLOCK} <b>Уведомления:</b> ${pad2(p.pollHour)}:00 (МСК)\n\n` +
    `${motivation}\n\n` +
    `<i>Выбери параметр для настройки:</i>`
  );
}

export function settingsRootKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: `${EMOJI.ZOZH} Сменить режим`, callback_data: 'settings:mode' }],
      [{ text: `${EMOJI.CLOCK} Время уведомлений`, callback_data: 'settings:time' }],
      [{ text: `${EMOJI.HOME} В главное меню`, callback_data: 'menu:back' }],
    ],
  };
}

export function settingsModeText(): string {
  return `🛣️ <b>Выбери свой стиль игры</b>\n\nКаждый режим предлагает уникальные цели и мотивацию!`;
}

export function settingsModeKeyboard(p: { mode: Mode }): InlineKeyboardMarkup {
  const zozhConfig = getModeTexts('zozh');
  const alcoConfig = getModeTexts('alco');
  
  const zozhText = p.mode === 'zozh' 
    ? `${zozhConfig.emoji} ${zozhConfig.name} ${EMOJI.CHECK}`
    : `${zozhConfig.emoji} ${zozhConfig.name}`;
    
  const alcoText = p.mode === 'alco' 
    ? `${alcoConfig.emoji} ${alcoConfig.name} ${EMOJI.CHECK}`
    : `${alcoConfig.emoji} ${alcoConfig.name}`;
  
  return {
    inline_keyboard: [
      [
        { text: zozhText, callback_data: 'mode:zozh' },
        { text: alcoText, callback_data: 'mode:alco' },
      ],
      [{ text: `${EMOJI.BACK} Назад к настройкам`, callback_data: 'settings:back' }],
    ],
  };
}

export function settingsTimeText(): string {
  return `⏰ <b>Выбери удобное время для уведомлений</b>\n\nМы напомним тебе в выбранный час (по Москве)`;
}

export function settingsTimeKeyboard(p: { pollHour: number }): InlineKeyboardMarkup {
  const hours = [18, 19, 20, 21, 22, 23];
  const rows = hours.map((h) => ({
    text: `${pad2(h)}:00${h === p.pollHour ? ` ${EMOJI.CHECK}` : ''}`,
    callback_data: `settings:poll_hour:${h}`,
  }));

  return {
    inline_keyboard: [
      rows.slice(0, 3),
      rows.slice(3),
      [{ text: `${EMOJI.BACK} Назад`, callback_data: 'settings:back' }],
    ],
  };
}

// ===== Улучшенный профиль с визуализацией =====
export function profileSummaryText(p: {
  login?: string;
  mode: Mode;
  soberCurrent: number; soberBest: number;
  drunkCurrent: number; drunkBest: number;
  soberDays: number; drunkDays: number; soberPct: number;
}): string {
  const config = getModeTexts(p.mode);
  const totalDays = p.soberDays + p.drunkDays;
  const levelDays = p.mode === 'zozh' ? p.soberDays : totalDays;
  const levelInfo = getUserLevelInfo(levelDays);
  
  const streakConfig = p.mode === 'zozh' 
    ? { main: p.soberCurrent, secondary: p.drunkCurrent, mainLabel: "Трезвость", secondaryLabel: "Перерывы" }
    : { main: p.drunkCurrent, secondary: p.soberCurrent, mainLabel: "В системе", secondaryLabel: "Завязка" };

  const mood = getMoodEmoji(streakConfig.main, p.mode);
  const achievement = getAchievementMessage(p.mode, streakConfig.main);
  
  // Визуальные прогресс-бары
  const mainBar = progressBarAdvanced(streakConfig.main, Math.max(streakConfig.main, 30), 10);
  const pctBar = progressBarAdvanced(p.soberPct, 100, 8);
  const levelBar = progressBarAdvanced(levelInfo.progress, 100, 6);

  return (
    `👤 <b>Мой прогресс</b> • ${config.name} ${config.emoji}\n` +
    `🎭 <b>${escapeHtml(p.login || 'Анонимный герой')}</b>\n\n` +
    
    `🎯 <b>Уровень ${levelInfo.badge} ${levelInfo.name} ${levelInfo.badge}</b>\n` +
    `${levelBar} <i>${levelInfo.progress}% до ${levelInfo.nextLevel}д</i>\n\n` +
    
    `🔥 <b>Текущие серии</b>\n` +
    `${EMOJI.FIRE} <b>${streakConfig.mainLabel}:</b> ${streakConfig.main}д ${mood}\n` +
    `${mainBar}\n` +
    `${EMOJI.BEER} <b>${streakConfig.secondaryLabel}:</b> ${streakConfig.secondary}д\n\n` +
    
    `🏆 <b>Лучшие результаты</b>\n` +
    `${EMOJI.MEDAL} Рекорд: <b>${p.mode === 'zozh' ? p.soberBest : p.drunkBest} дней</b>\n` +
    `${EMOJI.GRAPH} Статистика: <b>${p.soberDays}/${p.drunkDays}</b>\n` +
    `${EMOJI.CHART} Успешность: <b>${p.soberPct}%</b>\n` +
    `${pctBar}` +
    (achievement ? `\n\n🎉 <b>Достижение:</b> ${achievement}` : '')
  );
}

// Визуальные улучшения
function getMoodEmoji(days: number, mode: Mode): string {
  if (mode === 'zozh') {
    if (days >= 30) return EMOJI.GOD;
    if (days >= 14) return EMOJI.SUPERHERO;
    if (days >= 7) return EMOJI.CHAMPION;
    if (days >= 3) return EMOJI.ROCKET;
    return EMOJI.GROWING;
  } else {
    if (days >= 30) return EMOJI.KING;
    if (days >= 14) return EMOJI.WIZARD;
    if (days >= 7) return EMOJI.NINJA;
    if (days >= 3) return EMOJI.DETECTIVE;
    return EMOJI.PARTY;
  }
}

function progressBarAdvanced(current: number, max: number, width: number): string {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const filled = Math.round((percentage / 100) * width);
  
  const segments = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];
  const segmentIndex = Math.min(Math.floor(percentage / 20), segments.length - 1);
  const segment = segments[segmentIndex];
  
  return segment.repeat(filled) + '⬜'.repeat(Math.max(0, width - filled));
}

export function profileKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `${EMOJI.GOALS} Мои цели`, callback_data: 'profile:goals' },
        { text: `${EMOJI.TROPHY} Достижения`, callback_data: 'profile:achievements' }
      ],
      [{ text: `${EMOJI.HOME} В главное меню`, callback_data: 'menu:back' }],
    ],
  };
}

// Новая функция для экрана достижений
export function achievementsText(mode: Mode, soberDays: number, drunkDays: number): string {
  const config = getModeTexts(mode);
  const days = mode === 'zozh' ? soberDays : drunkDays;
  const levelInfo = getUserLevelInfo(days);
  const nextMilestone = EXTENDED_MILESTONES.find(m => m > days) || days + 1;
  
  // Ближайшие 8 вех (до года)
  const recentMilestones = EXTENDED_MILESTONES
    .filter(m => m <= 365 && m <= days + 100)
    .slice(-8);

  const milestones = recentMilestones
    .map(m => {
      const achieved = days >= m;
      const achievement = getAchievementMessage(mode, m);
      const progress = achieved ? '✅' : `⭕️ ${days}/${m}`;
      return `${progress} ${m} дней: ${achievement || 'Секретное достижение'}`;
    })
    .join('\n');

  return (
    `🏆 <b>Мои достижения</b> • ${config.name} ${config.emoji}\n\n` +
    `🎯 <b>Текущий уровень:</b> ${levelInfo.badge} ${levelInfo.name} (${levelInfo.level}/10)\n` +
    `📈 <b>Прогресс:</b> ${days} из ${nextMilestone} дней\n\n` +
    `<b>Ближайшие цели:</b>\n${milestones}\n\n` +
    `💡 <i>Всего достижений: ${EXTENDED_MILESTONES.filter(m => m <= days).length}/${EXTENDED_MILESTONES.filter(m => m <= 365).length}</i>`
  );
}

// ===== Опросы =====
export function todayPollText(question?: string, mode: Mode = 'zozh'): string {
  const config = getModeTexts(mode);
  const baseQuestion = question ?? config.poll.question;
  const hint = mode === 'zozh' ? 'Честный ответ поможет статистике!' : 'Будь честен - мы не осуждаем!';
  return `🎯 <b>${escapeHtml(baseQuestion)}</b>\n\n${hint}`;
}

export function todayPollKeyboard(pollId?: number, mode: Mode = 'zozh'): InlineKeyboardMarkup {
  const config = getModeTexts(mode);
  const id = pollId != null ? `:${pollId}` : '';
  
  const yesText = getRandomText(config.poll.yes);
  const noText = getRandomText(config.poll.no);
  
  return {
    inline_keyboard: [
      [
        { text: yesText, callback_data: `poll:answer:yes${id}` },
        { text: noText, callback_data: `poll:answer:no${id}` },
      ],
      [{ text: `${EMOJI.HOME} В меню`, callback_data: 'menu:back' }],
    ],
  };
}

export function chooseDrinkText(mode: Mode = 'zozh'): string { 
  return mode === 'zozh' 
    ? `🍹 <b>Что пробовал?</b>\n\nКакой напиток прервал твою серию?` 
    : `🍹 <b>Чё бухал?</b>\n\nВыбери свой напиток для статистики!`; 
}

export function chooseDrinkKeyboard(drinks: Array<{ id: number; name: string }>, mode: Mode = 'zozh'): InlineKeyboardMarkup {
  const rows: { text: string; callback_data: string }[][] = [];
  
  // Группируем напитки по 2 в ряд
  for (let i = 0; i < drinks.length; i += 2) {
    const row = drinks.slice(i, i + 2).map(d => ({
      text: `🍷 ${d.name}`,
      callback_data: `poll:drink:${d.id}`
    }));
    rows.push(row);
  }
  
  // Кнопки навигации
  rows.push([
    { text: `${EMOJI.BACK} Назад`, callback_data: 'poll:back_to_yesno' },
    { text: `${EMOJI.HOME} В меню`, callback_data: 'menu:back' },
  ]);
  
  return { inline_keyboard: rows };
}

export function chooseAmountText(drinkName: string, mode: Mode = 'zozh'): string {
  const prefix = mode === 'zozh' ? "Сколько выпил?" : "Сколько бухнул?";
  return `🍷 <b>${escapeHtml(drinkName)}</b>\n\n${prefix}\n\n<code>💡 1 порция ≈ 1 бокал вина / 0.5 л пива / 50 мл крепкого</code>`;
}

export function chooseAmountKeyboard(mode: Mode = 'zozh'): InlineKeyboardMarkup {
  const labels = mode === 'zozh' 
    ? ['1 🫗', '2 🫗🫗', '3 🫗🫗🫗', '4 🫗×4', '5+ 🫗×5'] 
    : ['1 🍺', '2 🍺🍺', '3 🍺🍺🍺', '4 🍺×4', '5+ 🍺×5'];
    
  // Гарантируем, что все элементы существуют
  const safeLabels = [
    labels[0] || '1',
    labels[1] || '2', 
    labels[2] || '3',
    labels[3] || '4',
    labels[4] || '5+'
  ];
  
  return {
    inline_keyboard: [
      [
        { text: safeLabels[0], callback_data: 'poll:amount:1' },
        { text: safeLabels[1], callback_data: 'poll:amount:2' },
        { text: safeLabels[2], callback_data: 'poll:amount:3' },
      ],
      [
        { text: safeLabels[3], callback_data: 'poll:amount:4' },
        { text: safeLabels[4], callback_data: 'poll:amount:5' },
      ],
      [
        { text: `${EMOJI.BACK} К напиткам`, callback_data: 'poll:back_to_drinks' },
        { text: `${EMOJI.HOME} В меню`, callback_data: 'menu:back' },
      ],
    ],
  };
}

// ===== Улучшенный лидерборд =====
export function leaderboardText(p: { 
  rows: LeaderRow[]; 
  page: number; 
  total: number; 
  pageSize: number;
  type?: LeaderboardType;
  mode?: Mode;
  userRank?: number;
}): string {
  const { rows, page, total, pageSize, type = 'current', mode, userRank } = p;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const boardConfig = LEADERBOARD_TYPES[type];
  
  // Заголовок с информацией о типе рейтинга и фильтрации
  let header = `🏆 <b>Топ игроков</b> • ${boardConfig.emoji} ${boardConfig.name}\n`;
  header += `<i>Страница ${page}/${pages}</i>\n\n`;
  
  if (mode) {
    const modeConfig = getModeTexts(mode);
    header += `<i>${EMOJI.FILTER} Фильтр: ${modeConfig.name} ${modeConfig.emoji}</i>\n`;
  }
  
  header += `<i>${boardConfig.description}</i>\n\n`;

  if (rows.length === 0) {
    return header + `${EMOJI.SAD} <b>Пока здесь пусто...</b>\nСтань первым в рейтинге!`;
  }

  // Отображение позиции пользователя если доступно
  let userInfo = '';
  if (userRank && userRank > 0) {
    userInfo = `\n\n🎯 <b>Твоя позиция в рейтинге: #${userRank}</b>`;
  }

  const lines = rows.map((r, index) => {
    const rankEmoji = getRankEmoji(r.rank);
    const progress = progressBarMini(r.sober_pct30, 5);
    const levelBadge = getUserLevelBadge(r.sober_best);
    
    return `${rankEmoji} <b>#${r.rank}</b> ${escapeHtml(r.name)} ${levelBadge}
${EMOJI.FIRE} Серия: <b>${r.sober_current}д</b> ${progress} <b>${r.sober_pct30}%</b>
${EMOJI.TROPHY} Рекорд: <b>${r.sober_best}д</b> • ${EMOJI.ACTIVITY} Активность: <b>${r.total_days}д</b>`;
  }).join(`\n\n`);

  return header + lines + userInfo;
}

export function leaderboardKeyboard(p: { 
  page: number; 
  total: number; 
  pageSize: number;
  type?: LeaderboardType;
  mode?: Mode;
}): InlineKeyboardMarkup {
  const { page, total, pageSize, type = 'current', mode } = p;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prev = Math.max(1, page - 1);
  const next = Math.min(pages, page + 1);

  const buttons: { text: string; callback_data: string }[] = [];

  // Кнопки переключения типов рейтинга
  const typeButtons = Object.entries(LEADERBOARD_TYPES).map(([key, config]) => ({
    text: key === type ? `${config.emoji} ${config.name} ✅` : `${config.emoji} ${config.name}`,
    callback_data: `leaderboard:type:${key}:${mode || 'all'}:1`
  }));

  // Кнопки фильтрации по режимам
  const filterButtons = [
    { text: `${EMOJI.FILTER} Все`, callback_data: `leaderboard:type:${type}:all:1` },
    { text: `${EMOJI.ZOZH} ЗОЖники`, callback_data: `leaderboard:type:${type}:zozh:1` },
    { text: `${EMOJI.ALCO} Алкоголики`, callback_data: `leaderboard:type:${type}:alco:1` }
  ];

  // Кнопки пагинации
  if (pages > 1) {
    buttons.push(
      { text: '« Пред', callback_data: `leaderboard:type:${type}:${mode || 'all'}:${prev}` },
      { text: 'След »', callback_data: `leaderboard:type:${type}:${mode || 'all'}:${next}` }
    );
  }

  buttons.push({ text: `${EMOJI.HOME} В меню`, callback_data: 'menu:back' });

  return {
    inline_keyboard: [
      typeButtons.slice(0, 2), // Первые два типа
      typeButtons.slice(2),    // Остальные типы
      filterButtons,           // Фильтры
      buttons                  // Пагинация и навигация
    ],
  };
}

// Вспомогательные функции для лидерборда
function getRankEmoji(rank: number): string {
  if (rank === 1) return EMOJI.CROWN;
  if (rank <= 3) return EMOJI.MEDAL;
  if (rank <= 10) return EMOJI.STAR;
  return EMOJI.BULLET;
}

function getUserLevelBadge(soberBest: number): string {
  if (soberBest >= 100) return '🐉';
  if (soberBest >= 30) return '🦅';
  if (soberBest >= 7) return '🚀';
  return '🐣';
}

function progressBarMini(pct: number, width = 5): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

// ===== Админка / статусы =====
export function adminText(): string {
  return (
    `⚡ <b>Админ-панель</b>\n\n` +
    `Доступные действия:\n` +
    `${EMOJI.ROCKET} <b>Массовый опрос</b> — отправить всем пользователям\n` +
    `${EMOJI.CLOCK} <b>Опрос по времени</b> — только для выбранного часа\n` +
    `${EMOJI.EDIT} <b>Крафтовый опрос</b> — с кастомным вопросом`
  );
}

export function adminKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🚨 Опросить всех сейчас', callback_data: 'admin:poll_all' }],
      [{ text: '🕐 Опрос по текущему часу', callback_data: 'admin:poll_hour' }],
      [{ text: '🧪 Создать кастомный опрос', callback_data: 'admin:craft' }],
      [{ text: `${EMOJI.HOME} В меню`, callback_data: 'menu:back' }],
    ],
  };
}

export function craftPromptText(): string {
  return (
    `🧪 <b>Создание кастомного опроса</b>\n\n` +
    `Пришли текст вопроса одним сообщением.\n\n` +
    `<code>💡 Пример: "Сегодня занимался спортом?"</code>\n` +
    `<code>💡 Пример: "Чувствуешь себя продуктивно?"</code>`
  );
}

export function craftResultText(ok: number, total: number, fail: number): string {
  return (
    `✅ <b>Кастомный опрос успешно разослан!</b>\n\n` +
    `${EMOJI.CHECK} Успешно: <b>${ok}</b> из ${total}\n` +
    `${EMOJI.WARNING} Ошибок: <b>${fail}</b>`
  );
}

export function pollAllResultText(ok: number, total: number, fail: number): string {
  return (
    `🌍 <b>Массовый опрос завершен!</b>\n\n` +
    `${EMOJI.CHECK} Получили: <b>${ok}</b> из ${total}\n` +
    `${EMOJI.WARNING} Проблемы: <b>${fail}</b>`
  );
}

export function pollHourResultText(hour: number, ok: number, total: number, fail: number): string {
  return (
    `⏰ <b>Опрос для ${pad2(hour)}:00 (МСК) завершен</b>\n\n` +
    `${EMOJI.CHECK} Успешно: <b>${ok}</b> из ${total}\n` +
    `${EMOJI.WARNING} Ошибок: <b>${fail}</b>`
  );
}

// ===== Утилиты =====
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function progressBar(pct: number, width = 10): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round((p / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
  return `\n${bar}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}