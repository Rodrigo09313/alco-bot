// Репозиторий для работы с сериями (streaks) и применением ответа дня.
import { q1 } from './sql.js';

export interface StreakRow {
  user_id: number;
  sober_current: number;
  sober_best: number;
  drunk_current: number;
  drunk_best: number;
  updated_at: string;
}

/**
 * Применить ответ пользователя:
 * - 'no'  -> +1 к sober_current, сброс drunk_current. Обновить sober_best при необходимости.
 * - 'yes' -> +1 к drunk_current, сброс sober_current. Обновить drunk_best при необходимости.
 * Возвращает обновлённую строку streaks.
 */
export async function applyAnswer(user_id: number, answer: 'yes' | 'no'): Promise<StreakRow> {
  if (answer === 'no') {
    return q1<StreakRow>(
      `UPDATE streaks
       SET sober_current = sober_current + 1,
           drunk_current = 0,
           sober_best    = GREATEST(sober_best, sober_current + 1),
           updated_at    = now()
       WHERE user_id=$1
       RETURNING *`,
      [user_id]
    ) as Promise<StreakRow>;
  } else {
    return q1<StreakRow>(
      `UPDATE streaks
       SET drunk_current = drunk_current + 1,
           sober_current = 0,
           drunk_best    = GREATEST(drunk_best, drunk_current + 1),
           updated_at    = now()
       WHERE user_id=$1
       RETURNING *`,
      [user_id]
    ) as Promise<StreakRow>;
  }
}
