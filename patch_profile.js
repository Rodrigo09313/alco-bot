// Найти функцию handleProfileCallback и заменить клавиатуру
// Ищем что-то вроде:
// async function handleProfileCallback(bot, cb, tgId) {
//   ... код ...
//   await editOrReplaceFromCallback(bot, cb, text, backOnlyKeyboard()); // <-- ЭТУ СТРОКУ
// }

// ЗАМЕНИТЬ на:
// await editOrReplaceFromCallback(bot, cb, text, profileKeyboard());
