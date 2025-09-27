#!/bin/bash

# Восстановим из backup если есть
if [ -f src/bot/handlers.ts.backup ]; then
    cp src/bot/handlers.ts.backup src/bot/handlers.ts
    echo "Восстановлен из backup"
else
    # Или исправим текущий файл
    # Найдем начало импортов и исправим
    sed -i '30,50d' src/bot/handlers.ts
fi

# Добавим правильные импорты
cat > /tmp/correct_imports.js << 'IMPORTS'
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

# Вставим импорты в правильное место
head -29 src/bot/handlers.ts > /tmp/header.ts
tail -n +31 src/bot/handlers.ts > /tmp/footer.ts

cat /tmp/header.ts /tmp/correct_imports.js /tmp/footer.ts > src/bot/handlers.ts

echo "Файл восстановлен!"
