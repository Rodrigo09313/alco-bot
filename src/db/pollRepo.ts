// Репозиторий опросов (daily/craft) + отметки ответов.
// Вставки делают upsert по (user_id, poll_date, kind), чтобы не падать на уникальности.

import { q, q1 } from './sql';

export type PollRow = {
  id: number;
  user_id: number;
  answer: 'yes' | 'no' | null;
  status: 'pending' | 'answered';
  kind: 'daily' | 'craft';
  question: string | null;
  poll_date: string;     // DATE как строка
  created_at: string;
  updated_at?: string;
};

// Ручной daily на сегодня (МСК).
// Если уже есть daily за сегодня — вернём его (ничего не трогаем).
export async function createManualPoll(userId: number): Promise<PollRow> {
  return q1<PollRow>(`
    INSERT INTO daily_polls(user_id, poll_date, status, kind)
    VALUES ($1, (now() AT TIME ZONE 'Europe/Moscow')::date, 'pending', 'daily')
    ON CONFLICT (user_id, poll_date, kind)
    DO UPDATE
      SET updated_at = now()
    RETURNING *
  `, [userId]) as Promise<PollRow>;
}

// Крафтовый опрос на сегодня (МСК).
// Если уже был craft сегодня — обновляем вопрос, сбрасываем статус на pending и ответ в NULL.
export async function createCraftPoll(userId: number, question: string): Promise<PollRow> {
  return q1<PollRow>(`
    INSERT INTO daily_polls(user_id, poll_date, status, kind, question)
    VALUES ($1, (now() AT TIME ZONE 'Europe/Moscow')::date, 'pending', 'craft', $2)
    ON CONFLICT (user_id, poll_date, kind)
    DO UPDATE
      SET question   = EXCLUDED.question,
          status     = 'pending',
          answer     = NULL,
          updated_at = now()
    RETURNING *
  `, [userId, question]) as Promise<PollRow>;
}

export async function setPollAnswerYes(pollId: number) {
  await q`UPDATE daily_polls SET answer='yes', status='answered', updated_at = now() WHERE id=${pollId}`;
}
export async function setPollAnswerNo(pollId: number) {
  await q`UPDATE daily_polls SET answer='no',  status='answered', updated_at = now() WHERE id=${pollId}`;
}
export async function getPollById(pollId: number) {
  return q1<PollRow>`SELECT * FROM daily_polls WHERE id=${pollId}`;
}
