import Redis from 'ioredis';
import { env } from '../config/env';
import { createLogger } from './logger';

const log = createLogger(process.env.LOG_LEVEL);

let client: Redis | null = null;

/**
 * Создаём singleton-клиент Redis.
 * maxRetriesPerRequest=null и enableReadyCheck=false — важные флаги для будущего BullMQ.
 */
export function getRedis() {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    client.on('error', (err) => {
      log.error({ err }, 'Redis error');
    });
  }
  return client;
}

/** Self-check: PING */
export async function checkRedis() {
  const r = getRedis();
  const pong = await r.ping();
  return pong === 'PONG';
}

/** Закрытие соединения */
export async function closeRedis() {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
