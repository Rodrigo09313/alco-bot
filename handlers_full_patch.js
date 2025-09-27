// Полный патч для handlers.ts - найти и заменить конкретные участки:

// 1. НАЙТИ обработчик menu:profile (примерно так):
/*
if (data === 'menu:profile') {
  const user = await getByTelegramId(tgId);
  if (!user) {
    await editOrReplaceFromCallback(bot, cb, needStartText(), backOnlyKeyboard());
    if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
    return;
  }
  
  // ... расчет статистики ...
  
  const text = profileSummaryText({ ... });
  await editOrReplaceFromCallback(bot, cb, text, backOnlyKeyboard()); // <-- ЭТУ СТРОКУ ЗАМЕНИТЬ
  if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});
  return;
}
*/

// ЗАМЕНИТЬ последнюю строку с клавиатурой на:
// await editOrReplaceFromCallback(bot, cb, text, profileKeyboard());

// 2. ДОБАВИТЬ после обработчика profile:goals (найти этот блок):

/*
if (data === 'profile:goals') {
  // ... существующий код ...
}
*/

// ПОСЛЕ него добавить новый обработчик:

if (data === 'profile:achievements') {
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
  return;
}
