// Мини-репозиторий для реакций: выбор активных по триггеру/режиму/локали.
// Позже добавим все фильтры и Redis-кулдауны.
import { q } from './sql.js';

export interface ReactionRow {
  id: number;
  trigger: string;
  mode: string | null;
  locale: string | null;
  text_template: string;
  media_type: 'none'|'sticker'|'photo'|'animation'|'audio';
  media_id: string | null;
  weight: number;
}

/**
 * Вернуть 1 случайную реакцию (взвешенно) по trigger (+ mode/locale как фильтры).
 * Взвешивание: ORDER BY -ln(random())/GREATEST(weight,1)
 * (эквивалент экспоненциального распределения для выбора).
 */
export async function pickReaction(params: {
  trigger: string;
  mode?: 'zozh' | 'alco' | null;
  locale?: string | null;
}) {
  const { trigger, mode = null, locale = null } = params;

  const rows = await q<ReactionRow>(
    `SELECT *
     FROM bot_reactions
     WHERE is_active = TRUE
       AND trigger = $1
       AND ($2::text IS NULL OR mode IS NULL OR mode = $2)
       AND ($3::text IS NULL OR locale IS NULL OR locale = $3)
     ORDER BY -LN(random()) / GREATEST(weight, 1)
     LIMIT 1`,
    [trigger, mode, locale]
  );

  return rows[0] ?? null;
}
