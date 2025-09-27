// src/db/pollRepo.ts
import { sql } from './pg';

/** Europe/Warsaw “сегодня” */
function todayWarsawDateExpr() {
  return sql`(now() at time zone 'Europe/Warsaw')::date`;
}

/**
 * Создаём/возвращаем запись опроса на сегодня.
 * ВАЖНО: если уже был ответ за сегодня, НЕ меняем status/answer.
 */
export async function createManualPoll(userId: number): Promise<{ id: number }> {
  const pollDateExpr = todayWarsawDateExpr();
  const [row] = await sql<{ id: number }>`
    insert into daily_polls (user_id, poll_date, status)
    values (${userId}, ${pollDateExpr}, 'pending')
    on conflict (user_id, poll_date) do update
      set attempt   = least(daily_polls.attempt + 1, 3),
          status    = case when daily_polls.status = 'answered'
                           then daily_polls.status
                           else 'pending'
                      end,
          updated_at = now()
    returning id
  `;
  return row;
}

export async function setPollAnswerNo(pollId: number) {
  await sql`
    update daily_polls
       set status = 'answered',
           answer = 'no',
           updated_at = now()
     where id = ${pollId}
  `;
}

export async function setPollAnswerYes(pollId: number) {
  await sql`
    update daily_polls
       set status = 'answered',
           answer = 'yes',
           updated_at = now()
     where id = ${pollId}
  `;
}

/** Получить запись опроса по id */
export async function getPollById(pollId: number): Promise<{
  id: number;
  user_id: number;
  poll_date: string;
  status: 'pending' | 'answered' | 'skipped';
  answer: 'yes' | 'no' | null;
} | null> {
  const [row] = await sql<{
    id: number; user_id: number; poll_date: string;
    status: 'pending'|'answered'|'skipped'; answer: 'yes'|'no'|null;
  }>`select id, user_id, poll_date::text as poll_date, status, answer
     from daily_polls where id = ${pollId} limit 1`;
  return row ?? null;
}
