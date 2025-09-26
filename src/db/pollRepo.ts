// Репозиторий для ежедневных опросов и записей потребления.
import { q, q1 } from './sql.js';

export interface PollRow {
  id: number;
  user_id: number;
  poll_date: string; // DATE в БД -> приходит как строка 'YYYY-MM-DD'
  attempt: number;
  status: 'pending' | 'answered' | 'skipped';
  answer: 'yes' | 'no' | null;
  created_at: string;
  updated_at: string;
}

/** Создать pending опрос на дату (идемпотентно по UNIQUE(user_id,poll_date)) */
export async function createPending(user_id: number, dateISO: string): Promise<PollRow> {
  const row = await q1<PollRow>(
    `INSERT INTO daily_polls(user_id, poll_date, attempt, status)
     VALUES($1, $2::date, 1, 'pending')
     ON CONFLICT (user_id, poll_date)
       DO UPDATE SET updated_at = now()
     RETURNING *`,
    [user_id, dateISO]
  );
  return row!;
}

export async function getPoll(user_id: number, dateISO: string) {
  return q1<PollRow>(
    `SELECT * FROM daily_polls WHERE user_id=$1 AND poll_date=$2::date`,
    [user_id, dateISO]
  );
}

export async function setPollAnswered(user_id: number, dateISO: string, answer: 'yes'|'no') {
  return q1<PollRow>(
    `UPDATE daily_polls
       SET status='answered', answer=$3, updated_at=now()
     WHERE user_id=$1 AND poll_date=$2::date
     RETURNING *`,
    [user_id, dateISO, answer]
  );
}

export async function bumpAttempt(user_id: number, dateISO: string) {
  return q1<PollRow>(
    `UPDATE daily_polls
       SET attempt = LEAST(attempt + 1, 3), updated_at=now()
     WHERE user_id=$1 AND poll_date=$2::date
     RETURNING *`,
    [user_id, dateISO]
  );
}

/** Добавить запись потребления (минимум: код напитка и кол-во дринков) */
export async function addConsumption(params: {
  user_id: number;
  local_date: string;       // 'YYYY-MM-DD'
  drink_code: string;       // FK -> drinks.code
  drinks_count: number;
  ml?: number | null;
  pure_alcohol_ml?: number | null;
  cost?: number | null;
}) {
  const { user_id, local_date, drink_code, drinks_count, ml, pure_alcohol_ml, cost } = params;
  await q(
    `INSERT INTO consumption_records(user_id, local_date, drink_code, drinks_count, ml, pure_alcohol_ml, cost)
     VALUES ($1, $2::date, $3, $4, $5, $6, $7)`,
    [user_id, local_date, drink_code, drinks_count, ml ?? null, pure_alcohol_ml ?? null, cost ?? null]
  );
}
