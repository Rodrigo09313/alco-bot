// Простой thin-слой над pg.Pool: единая точка входа для запросов.
// Это удобно для логирования/трассировки и будущих транзакций.

import { getPg } from './pg.js';

export type QueryableRow = Record<string, unknown>;

/** Выполнить параметризованный SQL */
export async function q<T extends QueryableRow = any>(text: string, params: any[] = []) {
  const pg = getPg();
  const res = await pg.query<T>(text, params);
  return res.rows;
}

/** Взять одну строку или null */
export async function q1<T extends QueryableRow = any>(text: string, params: any[] = []) {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
