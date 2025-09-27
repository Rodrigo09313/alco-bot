import { q, q1 } from './sql';

export type DrinkRow = { id: number; code: string; name: string };

export async function listActiveDrinks(): Promise<DrinkRow[]> {
  return q<DrinkRow>`
    SELECT id, code, name
    FROM drinks
    ORDER BY id ASC
  `;
}

export async function getDrinkById(id: number): Promise<DrinkRow | null> {
  return q1<DrinkRow>`
    SELECT id, code, name
    FROM drinks
    WHERE id = ${id}
    LIMIT 1
  `;
}
