/**
 * Простой файловый мигратор:
 * - Выполняет *.sql из ./migrations по алфавиту.
 * - Ведёт журнал в таблице _migrations (id TEXT PK, applied_at TIMESTAMPTZ).
 * - Повторно применённые файлы пропускает.
 *
 * Для работы нужен DATABASE_URL в .env
 */
import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGR_DIR = path.resolve(__dirname, '..', 'migrations');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL не задан в .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = fs.existsSync(MIGR_DIR)
    ? fs.readdirSync(MIGR_DIR).filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [];

  for (const file of files) {
    const id = file;
    const { rows } = await client.query('SELECT 1 FROM _migrations WHERE id=$1', [id]);
    if (rows.length) {
      console.log(`⏭  Уже применена: ${id}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGR_DIR, file), 'utf8');
    console.log(`▶️  Применяем: ${id}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      console.log(`✅ OK: ${id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Ошибка в ${id}:`, err);
      process.exit(1);
    }
  }

  await client.end();
  console.log('🎉 Все миграции применены');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
