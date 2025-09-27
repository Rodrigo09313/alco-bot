// leaderboardRepo.ts
// Таблица лидеров с поддержкой мульти-рейтингов и улучшенной структурой

import { q, q1 } from './sql.js';

export type LeaderboardType = 
  | 'current'    // Текущая трезвая серия (по умолчанию)
  | 'best'       // Лучшая трезвая серия
  | 'percentage' // Процент трезвых за 30 дней
  | 'activity';  // Активность (количество дней с ответами)

export type LeaderRow = {
  rank: number;
  user_id: number;
  name: string;
  sober_current: number;
  sober_best: number;
  sober30: number;
  drunk30: number;
  sober_pct30: number;
  portions30: number;
  total_days: number;
  mode?: 'zozh' | 'alco';
};

// Базовый тип для строки из БД
type DbLeaderRow = {
  user_id: number; 
  name: string;
  sober_current: number | null; 
  sober_best: number | null;
  sober30: number | null; 
  drunk30: number | null; 
  sober_pct30: number;
  portions30: number | null;
  total_days: number | null;
  mode: 'zozh' | 'alco' | null;
};

const RANKING_CONFIG: Record<LeaderboardType, string> = {
  current: 's.sober_current DESC NULLS LAST, s.sober_best DESC NULLS LAST, sober_pct30 DESC',
  best: 's.sober_best DESC NULLS LAST, s.sober_current DESC NULLS LAST, sober_pct30 DESC',
  percentage: 'sober_pct30 DESC, s.sober_current DESC NULLS LAST, s.sober_best DESC NULLS LAST',
  activity: 'total_days DESC, s.sober_current DESC NULLS LAST, sober_pct30 DESC'
};

export async function getLeaderboard(
  page = 1, 
  pageSize = 10, 
  type: LeaderboardType = 'current',
  mode?: 'zozh' | 'alco',
  userId?: number
): Promise<{
  rows: LeaderRow[]; 
  total: number; 
  page: number; 
  pageSize: number;
  userRank?: number;
}> {
  
  const p = Math.max(1, page);
  const ps = Math.min(Math.max(1, pageSize), 50);
  const offset = (p - 1) * ps;
  const rankingOrder = RANKING_CONFIG[type] || RANKING_CONFIG.current;

  // Подсчет общего количества
  const totalRow = await (mode 
    ? q1<{ cnt: number }>`SELECT COUNT(*)::int AS cnt FROM users u WHERE u.mode = ${mode}`
    : q1<{ cnt: number }>`SELECT COUNT(*)::int AS cnt FROM users u`
  );
  const total = totalRow?.cnt ?? 0;

  // Основной запрос - используем явное приведение типа
  let dbRows: DbLeaderRow[];
  
  if (mode) {
    const result = await q`
      WITH last30 AS (
        SELECT user_id,
               SUM((answer='no')::int) AS sober30,
               SUM((answer='yes')::int) AS drunk30
        FROM daily_polls
        WHERE poll_date >= ((now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '30 days')
        GROUP BY user_id
      ),
      cons30 AS (
        SELECT user_id, COALESCE(SUM(amount),0)::int AS portions30
        FROM consumption_records
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
      ),
      activity AS (
        SELECT user_id, COUNT(*)::int AS total_days
        FROM daily_polls
        GROUP BY user_id
      )
      SELECT
        u.id AS user_id,
        COALESCE(NULLIF(u.login, ''), '@' || u.telegram_id::text) AS name,
        s.sober_current, s.sober_best,
        COALESCE(l.sober30,0)::int AS sober30,
        COALESCE(l.drunk30,0)::int AS drunk30,
        CASE
          WHEN COALESCE(l.sober30,0) + COALESCE(l.drunk30,0) > 0
          THEN ROUND( (COALESCE(l.sober30,0)::numeric * 100) / (COALESCE(l.sober30,0)+COALESCE(l.drunk30,0)) )::int
          ELSE 0
        END AS sober_pct30,
        COALESCE(c.portions30,0)::int AS portions30,
        COALESCE(a.total_days,0)::int AS total_days,
        u.mode
      FROM users u
      LEFT JOIN streaks s ON s.user_id = u.id
      LEFT JOIN last30 l ON l.user_id = u.id
      LEFT JOIN cons30 c ON c.user_id = u.id
      LEFT JOIN activity a ON a.user_id = u.id
      WHERE u.mode = ${mode}
      ORDER BY ${rankingOrder}, u.id ASC
      LIMIT ${ps} OFFSET ${offset}
    `;
    dbRows = result as unknown as DbLeaderRow[];
  } else {
    const result = await q`
      WITH last30 AS (
        SELECT user_id,
               SUM((answer='no')::int) AS sober30,
               SUM((answer='yes')::int) AS drunk30
        FROM daily_polls
        WHERE poll_date >= ((now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '30 days')
        GROUP BY user_id
      ),
      cons30 AS (
        SELECT user_id, COALESCE(SUM(amount),0)::int AS portions30
        FROM consumption_records
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
      ),
      activity AS (
        SELECT user_id, COUNT(*)::int AS total_days
        FROM daily_polls
        GROUP BY user_id
      )
      SELECT
        u.id AS user_id,
        COALESCE(NULLIF(u.login, ''), '@' || u.telegram_id::text) AS name,
        s.sober_current, s.sober_best,
        COALESCE(l.sober30,0)::int AS sober30,
        COALESCE(l.drunk30,0)::int AS drunk30,
        CASE
          WHEN COALESCE(l.sober30,0) + COALESCE(l.drunk30,0) > 0
          THEN ROUND( (COALESCE(l.sober30,0)::numeric * 100) / (COALESCE(l.sober30,0)+COALESCE(l.drunk30,0)) )::int
          ELSE 0
        END AS sober_pct30,
        COALESCE(c.portions30,0)::int AS portions30,
        COALESCE(a.total_days,0)::int AS total_days,
        u.mode
      FROM users u
      LEFT JOIN streaks s ON s.user_id = u.id
      LEFT JOIN last30 l ON l.user_id = u.id
      LEFT JOIN cons30 c ON c.user_id = u.id
      LEFT JOIN activity a ON a.user_id = u.id
      ORDER BY ${rankingOrder}, u.id ASC
      LIMIT ${ps} OFFSET ${offset}
    `;
    dbRows = result as unknown as DbLeaderRow[];
  }

  // Преобразование результатов - теперь TypeScript знает тип
  const rows: LeaderRow[] = dbRows.map((r, i) => ({
    rank: offset + i + 1,
    user_id: r.user_id,
    name: r.name,
    sober_current: r.sober_current ?? 0,
    sober_best: r.sober_best ?? 0,
    sober30: r.sober30 ?? 0,
    drunk30: r.drunk30 ?? 0,
    sober_pct30: r.sober_pct30 ?? 0,
    portions30: r.portions30 ?? 0,
    total_days: r.total_days ?? 0,
    mode: r.mode ?? undefined
  }));

  // Расчет позиции пользователя
  let userRank: number | undefined;
  if (userId) {
    userRank = await calculateUserRank(userId, type, mode);
  }

  return { rows, total, page: p, pageSize: ps, userRank };
}

async function calculateUserRank(
  userId: number, 
  type: LeaderboardType = 'current',
  mode?: 'zozh' | 'alco'
): Promise<number> {
  try {
    const rankingOrder = RANKING_CONFIG[type] || RANKING_CONFIG.current;
    
    const rankRow = await (mode
      ? q1<{ user_rank: number }>`
          WITH ranked_users AS (
            SELECT u.id,
                   ROW_NUMBER() OVER (ORDER BY ${rankingOrder}, u.id ASC) as user_rank
            FROM users u
            LEFT JOIN streaks s ON s.user_id = u.id
            LEFT JOIN (
              SELECT user_id,
                     SUM((answer='no')::int) AS sober30,
                     SUM((answer='yes')::int) AS drunk30
              FROM daily_polls
              WHERE poll_date >= ((now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '30 days')
              GROUP BY user_id
            ) l ON l.user_id = u.id
            WHERE u.mode = ${mode}
          )
          SELECT user_rank FROM ranked_users WHERE id = ${userId}
        `
      : q1<{ user_rank: number }>`
          WITH ranked_users AS (
            SELECT u.id,
                   ROW_NUMBER() OVER (ORDER BY ${rankingOrder}, u.id ASC) as user_rank
            FROM users u
            LEFT JOIN streaks s ON s.user_id = u.id
            LEFT JOIN (
              SELECT user_id,
                     SUM((answer='no')::int) AS sober30,
                     SUM((answer='yes')::int) AS drunk30
              FROM daily_polls
              WHERE poll_date >= ((now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '30 days')
              GROUP BY user_id
            ) l ON l.user_id = u.id
          )
          SELECT user_rank FROM ranked_users WHERE id = ${userId}
        `
    );

    return rankRow?.user_rank ?? 0;
  } catch (error) {
    console.error('Ошибка расчета ранга пользователя:', error);
    return 0;
  }
}

export async function getUserStats(userId: number) {
  const stats = await q1<{
    sober_current: number | null;
    sober_best: number | null;
    drunk_current: number | null;
    drunk_best: number | null;
    sober30: number | null;
    drunk30: number | null;
    sober_pct30: number | null;
    portions30: number | null;
    total_days: number | null;
  }>`
    WITH last30 AS (
      SELECT user_id,
             SUM((answer='no')::int) AS sober30,
             SUM((answer='yes')::int) AS drunk30
      FROM daily_polls
      WHERE poll_date >= ((now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '30 days')
        AND user_id = ${userId}
      GROUP BY user_id
    ),
    cons30 AS (
      SELECT user_id, COALESCE(SUM(amount),0)::int AS portions30
      FROM consumption_records
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND user_id = ${userId}
      GROUP BY user_id
    ),
    activity AS (
      SELECT user_id, COUNT(*)::int AS total_days
      FROM daily_polls
      WHERE user_id = ${userId}
      GROUP BY user_id
    )
    SELECT
      s.sober_current, s.sober_best, s.drunk_current, s.drunk_best,
      COALESCE(l.sober30,0)::int AS sober30,
      COALESCE(l.drunk30,0)::int AS drunk30,
      CASE
        WHEN COALESCE(l.sober30,0) + COALESCE(l.drunk30,0) > 0
        THEN ROUND( (COALESCE(l.sober30,0)::numeric * 100) / (COALESCE(l.sober30,0)+COALESCE(l.drunk30,0)) )::int
        ELSE 0
      END AS sober_pct30,
      COALESCE(c.portions30,0)::int AS portions30,
      COALESCE(a.total_days,0)::int AS total_days
    FROM users u
    LEFT JOIN streaks s ON s.user_id = u.id
    LEFT JOIN last30 l ON l.user_id = u.id
    LEFT JOIN cons30 c ON c.user_id = u.id
    LEFT JOIN activity a ON a.user_id = u.id
    WHERE u.id = ${userId}
  `;

  if (!stats) return null;

  return {
    sober_current: stats.sober_current ?? 0,
    sober_best: stats.sober_best ?? 0,
    drunk_current: stats.drunk_current ?? 0,
    drunk_best: stats.drunk_best ?? 0,
    sober30: stats.sober30 ?? 0,
    drunk30: stats.drunk30 ?? 0,
    sober_pct30: stats.sober_pct30 ?? 0,
    portions30: stats.portions30 ?? 0,
    total_days: stats.total_days ?? 0
  };
}

// Для обратной совместимости
export async function getLeaderboardLegacy(page = 1, pageSize = 10) {
  return getLeaderboard(page, pageSize, 'current');
}