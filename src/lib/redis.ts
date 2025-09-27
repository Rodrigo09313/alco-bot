import Redis from 'ioredis';
import { env } from '../config/env.js';
import { createLogger } from './logger.js';

const log = createLogger(process.env.LOG_LEVEL);

let client: Redis | null = null;

/**
 * Singleton-клиент Redis (ioredis).
 * ВНИМАНИЕ: для команд с опциями используем строковые флаги, например:
 *   await r.set(key, '1', 'EX', 3600, 'NX')
 */
export function getRedis() {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    client.on('error', (err) => {
      log.error({ err }, 'Redis error');
    });
  }
  return client as unknown as Redis; // стабильный тип
}

export async function checkRedis() {
  const r = getRedis();
  const pong = await r.ping();
  return pong === 'PONG';
}

export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
