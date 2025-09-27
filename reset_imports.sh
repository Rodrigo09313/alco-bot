#!/bin/bash

# Создаем backup
cp src/bot/handlers.ts src/bot/handlers.ts.backup

# Восстанавливаем правильную структуру импортов
sed -i '30,40d' src/bot/handlers.ts

# Вставляем правильные импорты
cat > /tmp/imports.txt << 'IMPORTS'
import {
  // Главное меню
  mainMenuText, mainMenuKeyboard, backOnlyKeyboard, backToProfileKeyboard, toMenuKeyboard,
  needStartText, emptyTextError,
  // Онбординг
  askLoginText, chooseModeText, chooseModeKeyboard,
  // Настройки
  settingsRootText, settingsRootKeyboard, settingsModeText, settingsModeKeyboard,
  settingsTimeText, settingsTimeKeyboard,
  type SettingsMode,
  // Профиль
  profileSummaryText, profileKeyboard, achievementsText,
  // Админ
  adminText, adminKeyboard, craftPromptText,
  craftResultText, pollAllResultText, pollHourResultText,
  // Типы
  type Mode,
} from '../ui/text.js';
IMPORTS

# Вставляем импорты в файл
sed -i '30e cat /tmp/imports.txt' src/bot/handlers.ts

echo "Импорты восстановлены!"
