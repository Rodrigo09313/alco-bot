// В основном callback обработчике (строки 395-403) добавить новый case
// БЫЛО:
// if (data === 'profile:goals') {
//   await handleGoalsCallback(bot, cb, tgId);
//   return;
// }

// СТАТЬ:
// if (data === 'profile:goals') {
//   await handleGoalsCallback(bot, cb, tgId);
//   return;
// }

// if (data === 'profile:achievements') {
//   await handleAchievementsCallback(bot, cb, tgId);
//   return;
// }
