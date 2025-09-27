// Таблица лидеров: топ по текущей трезвой серии, затем по лучшей серии и % трезвых за 30 дней.
// Пагинация: limit/offset. МСК используем для окна 30 дней по poll_date.

import { q, q1 } from './sql.js';

export type LeaderRow = {
  rank: number;           // порядковый номер в выдаче
  user_id: number;
  name: string;           // login или @telegram_id
  sober_current: number;  // текущая трезвая серия
  sober_best: number;     // лучшая трезвая серия
  sober30: number;        // трезвых дней за 30д
  drunk30: number;        // пьяных дней за 30д
  sober_pct30: number;    // % трезвых за 30д
  portions30: number;     // суммарно порций за 30д
};

export async function getLeaderboard(page = 1, pageSize = 10): Promise<{
  rows: LeaderRow[]; total: number; page: number; pageSize: number;
}> {
  const p = Math.max(1, page);
  const ps = Math.min(Math.max(1, pageSize), 50);
  const offset = (p - 1) * ps;

  const totalRow = await q1<{ cnt: number }>`
    SELECT COUNT(*)::int AS cnt FROM users
  `;
  const total = totalRow?.cnt ?? 0;

  const rows = await q<Array<{
    user_id: number; name: string;
    sober_current: number | null; sober_best: number | null;
    sober30: number | null; drunk30: number | null; sober_pct30: number;
    portions30: number | null;
  }>>`
    WITH last30 AS (
      SELECT user_id,
             SUM((answer='no')::int)  AS sober30,
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
      COALESCE(c.portions30,0)::int AS portions30
    FROM users u
    LEFT JOIN streaks s ON s.user_id = u.id
    LEFT JOIN last30  l ON l.user_id = u.id
    LEFT JOIN cons30  c ON c.user_id = u.id
    ORDER BY
      s.sober_current DESC NULLS LAST,
      s.sober_best    DESC NULLS LAST,
      sober_pct30     DESC,
      u.id ASC
    LIMIT ${ps} OFFSET ${offset}
  `;

  const out: LeaderRow[] = rows.map((r, i) => ({
    rank: offset + i + 1,
    user_id: r.user_id,
    name: r.name,
    sober_current: r.sober_current ?? 0,
    sober_best: r.sober_best ?? 0,
    sober30: r.sober30 ?? 0,
    drunk30: r.drunk30 ?? 0,
    sober_pct30: r.sober_pct30 ?? 0,
    portions30: r.portions30 ?? 0,
  }));

  return { rows: out, total, page: p, pageSize: ps };
}
