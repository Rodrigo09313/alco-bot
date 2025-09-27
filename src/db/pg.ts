import postgres from 'postgres';

// Если .env не подхватился — дефолт на твой проброшенный порт 5433
const url = process.env.DATABASE_URL ?? 'postgres://alco:alco@localhost:5433/alco';

// Один клиент на всё приложение
export const sql = postgres(url, {
  prepare: true,
  max: 10,
});

// Транзакции
export async function withTransaction<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(fn);
}

/** Совместимость со старым кодом */
export function getPg() {
  return sql;
}

/** Возвращает число 1, чтобы прохождение healthcheck было совместимо с index.ts */
export async function checkPg(): Promise<number> {
  const [row] = await sql<{ one: number }>`select 1 as one`;
  return row?.one ?? 0;
}

export async function closePg() {
  // мягко закрываем пул
  await sql.end({ timeout: 5 });
}
