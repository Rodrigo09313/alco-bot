// Репозиторий пользователей + выборки для планировщика/админки.

import { q, q1 } from './sql';
export type Mode = 'zozh' | 'alco';

export interface UserRow {
  id: number;
  telegram_id: number;
  login: string | null;
  mode: Mode | null;
  poll_hour: number;
  registered_at: string; // timestamptz
}

export async function createOrGet(telegram_id: number): Promise<UserRow> {
  const exist = await q1<UserRow>('SELECT * FROM users WHERE telegram_id=$1', [telegram_id]);
  if (exist) return exist;

  const user = await q1<UserRow>(
    `INSERT INTO users(telegram_id) VALUES($1)
     RETURNING *`,
    [telegram_id]
  );

  await q(
    `INSERT INTO streaks(user_id) VALUES($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [user!.id]
  );

  return user!;
}

export async function getByTelegramId(telegram_id: number) {
  return q1<UserRow>('SELECT * FROM users WHERE telegram_id=$1', [telegram_id]);
}

export async function updateLogin(telegram_id: number, login: string | null) {
  return q1<UserRow>(
    `UPDATE users SET login=$2 WHERE telegram_id=$1 RETURNING *`,
    [telegram_id, login]
  );
}

export async function updateMode(telegram_id: number, mode: Mode) {
  return q1<UserRow>(
    `UPDATE users SET mode=$2 WHERE telegram_id=$1 RETURNING *`,
    [telegram_id, mode]
  );
}

export async function updatePollHour(telegram_id: number, poll_hour: number) {
  return q1<UserRow>(
    `UPDATE users SET poll_hour=$2 WHERE telegram_id=$1 RETURNING *`,
    [telegram_id, poll_hour]
  );
}

// ===== Выборки для планировщика/админки =====
export async function listUsersByPollHour(hour: number): Promise<Array<Pick<UserRow,'id'|'telegram_id'>>> {
  return q<Array<Pick<UserRow,'id'|'telegram_id'>>>(`SELECT id, telegram_id FROM users WHERE poll_hour = $1`, [hour]);
}

export async function listAllUsers(): Promise<Array<Pick<UserRow,'id'|'telegram_id'>>> {
  return q<Array<Pick<UserRow,'id'|'telegram_id'>>>(`SELECT id, telegram_id FROM users`, []);
}
