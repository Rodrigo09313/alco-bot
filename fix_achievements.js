// 1. Добавить achievementsText в импорты (строка 35)
// БЫЛО: 
//   profileSummaryText, profileKeyboard,
// СТАТЬ:
//   profileSummaryText, profileKeyboard, achievementsText,

// 2. Добавить обработчик после profile:goals (после строки 403)
// Найти:
if (data === 'profile:goals') {
  await handleGoalsCallback(bot, cb, tgId);
  return;
}

// ДОБАВИТЬ ПОСЛЕ:
if (data === 'profile:achievements') {
  await handleAchievementsCallback(bot, cb, tgId);
  return;
}

// 3. Добавить саму функцию handleAchievementsCallback после handleGoalsCallback
// Найти конец функции handleGoalsCallback и добавить после:

async function handleAchievementsCallback(bot: TelegramBot, cb: TelegramBot.CallbackQuery, tgId: number) {
  const user = await getByTelegramId(tgId);
  if (!user) {
    await editOrReplaceFromCallback(bot, cb, needStartText(), backOnlyKeyboard());
    if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
    return;
  }
  
  const totals = await q1<{ no_cnt: number; yes_cnt: number }>`
    SELECT COALESCE(SUM((answer='no')::int),0)::int AS no_cnt,
           COALESCE(SUM((answer='yes')::int),0)::int AS yes_cnt
    FROM daily_polls WHERE user_id = ${user.id}
  `;
  
  const soberDays = totals?.no_cnt ?? 0;
  const drunkDays = totals?.yes_cnt ?? 0;
  
  const text = achievementsText(user.mode as Mode, soberDays, drunkDays);
  await editOrReplaceFromCallback(bot, cb, text, backToProfileKeyboard());
  if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
}
