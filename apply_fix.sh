#!/bin/bash

FILE="src/bot/handlers.ts"

echo "1. Обновляем импорты..."
# Добавляем achievementsText в импорты
sed -i '35s/}/, achievementsText}/' $FILE

echo "2. Добавляем обработчик в основной callback..."
# Добавляем обработчик после profile:goals
sed -i '/if (data === '\''profile:goals'\'') {/,/return;/{
/return;/a\
\
      if (data === '\''profile:achievements'\'') {\
        await handleAchievementsCallback(bot, cb, tgId);\
        return;\
      }
}' $FILE

echo "3. Добавляем функцию handleAchievementsCallback..."
# Добавляем функцию после handleGoalsCallback
sed -i '/^async function handleGoalsCallback/,/^}$/{
/^}$/a\
\
async function handleAchievementsCallback(bot: TelegramBot, cb: TelegramBot.CallbackQuery, tgId: number) {\
  const user = await getByTelegramId(tgId);\
  if (!user) {\
    await editOrReplaceFromCallback(bot, cb, needStartText(), backOnlyKeyboard());\
    if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});\
    return;\
  }\
  \
  const totals = await q1<{ no_cnt: number; yes_cnt: number }>`\
    SELECT COALESCE(SUM((answer=''\''no'\''')::int),0)::int AS no_cnt,\
           COALESCE(SUM((answer=''\''yes'\''')::int),0)::int AS yes_cnt\
    FROM daily_polls WHERE user_id = \${user.id}\
  `;\
  \
  const soberDays = totals?.no_cnt ?? 0;\
  const drunkDays = totals?.yes_cnt ?? 0;\
  \
  const text = achievementsText(user.mode as Mode, soberDays, drunkDays);\
  await editOrReplaceFromCallback(bot, cb, text, backToProfileKeyboard());\
  if (cb.id) await bot.answerCallbackQuery(cb.id).catch(() => {});\
}
}' $FILE

echo "Готово! Проверяем изменения..."
grep -n -E "(achievementsText|profile:achievements|handleAchievementsCallback)" $FILE
