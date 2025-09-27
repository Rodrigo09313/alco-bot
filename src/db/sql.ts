import { sql, withTransaction } from './pg';

/**
 * Бэкомпат: q / q1 принимают:
 *  1) Tagged template: q`SELECT ... WHERE id=${id}`
 *  2) Старый стиль:     q("SELECT ... WHERE id=$1", [id])
 */
type SQLTemplate = TemplateStringsArray | string;

export async function q<T = any>(stringsOrText: SQLTemplate, ...values: any[]): Promise<T[]> {
  if (typeof stringsOrText === 'string') {
    // Старый стиль: q("...$1,...$2", [v1, v2])
    const params = (values && values.length ? values[0] : []) as any[];
    const rows = await (sql as any).unsafe(stringsOrText, params);
    return rows as unknown as T[];
  } else {
    // Новый стиль: q`... ${v1} ... ${v2}`
    const rows = await (sql as any)(stringsOrText as TemplateStringsArray, ...values);
    return rows as unknown as T[];
  }
}

export async function q1<T = any>(stringsOrText: SQLTemplate, ...values: any[]): Promise<T | null> {
  if (typeof stringsOrText === 'string') {
    const params = (values && values.length ? values[0] : []) as any[];
    const rows = await (sql as any).unsafe(stringsOrText, params);
    const arr = rows as unknown as T[];
    return arr[0] ?? null;
  } else {
    const rows = await (sql as any)(stringsOrText as TemplateStringsArray, ...values);
    const arr = rows as unknown as T[];
    return arr[0] ?? null;
  }
}

export { withTransaction };
