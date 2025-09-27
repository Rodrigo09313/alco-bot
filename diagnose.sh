#!/bin/bash
echo "=== ДИАГНОСТИКА ACHIEVEMENTS ==="
echo "1. Проверка handlers.ts:"
echo "--- Обработчики achievements:"
grep -n -E "(profile:achievements|handleAchievementsCallback)" src/bot/handlers.ts
echo "--- Импорты из text.ts:"
grep -n "from.*text" src/bot/handlers.ts | head -5

echo ""
echo "2. Проверка text.ts:"
echo "--- Функция achievementsText:"
grep -n "export function achievementsText" src/ui/text.ts
echo "--- Клавиатура профиля:"
grep -A 15 "export function profileKeyboard" src/ui/text.ts

echo ""
echo "3. Проверка сборки:"
npm run build 2>&1 | grep -i error | head -5

echo ""
echo "=== ДИАГНОСТИКА ЗАВЕРШЕНА ==="
