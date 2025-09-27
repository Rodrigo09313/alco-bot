import { sql } from './pg';

/*
Таблица streaks ожидается со столбцами:
  user_id bigint primary key
  sober_current int not null default 0
  sober_best    int not null default 0
  drunk_current int not null default 0
  drunk_best    int not null default 0
  updated_at    timestamptz not null default now()
*/

export async function touchStreaksOnNo(userId: number) {
  // Не пил: +1 к трезвой, best обновляем, пьяную обнуляем
  await sql`
    insert into streaks as s(user_id, sober_current, sober_best, drunk_current, drunk_best, updated_at)
    values (${userId}, 1, 1, 0, 0, now())
    on conflict (user_id) do update
      set sober_current = s.sober_current + 1,
          sober_best    = greatest(s.sober_best, s.sober_current + 1),
          drunk_current = 0,
          updated_at    = now()
  `;
}

export async function touchStreaksOnYes(userId: number) {
  // Пил: +1 к пьяной, best обновляем, трезвую обнуляем
  await sql`
    insert into streaks as s(user_id, sober_current, sober_best, drunk_current, drunk_best, updated_at)
    values (${userId}, 0, 0, 1, 1, now())
    on conflict (user_id) do update
      set drunk_current = s.drunk_current + 1,
          drunk_best    = greatest(s.drunk_best, s.drunk_current + 1),
          sober_current = 0,
          updated_at    = now()
  `;
}

/** Совместимость: applyAnswer(userId, 'yes' | 'no') */
export async function applyAnswer(userId: number, answer: 'yes' | 'no') {
  if (answer === 'no') return touchStreaksOnNo(userId);
  return touchStreaksOnYes(userId);
}
