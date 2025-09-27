// Репозиторий пользователей: создание и обновление полей регистрации.
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

/** Создать пользователя, если не существует; вернуть запись */
export async function createOrGet(telegram_id: number): Promise<UserRow> {
  // Пробуем найти
  const exist = await q1<UserRow>('SELECT * FROM users WHERE telegram_id=$1', [telegram_id]);
  if (exist) return exist;

  // Вставляем пользователя
  const user = await q1<UserRow>(
    `INSERT INTO users(telegram_id) VALUES($1)
     RETURNING *`,
    [telegram_id]
  );

  // Инициализируем streaks для него (0 значения)
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
