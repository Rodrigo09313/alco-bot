import { getRedis } from '../lib/redis';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger(process.env.LOG_LEVEL);
const TTL = Number(env.SESSION_TTL ?? 3600); // seconds
const KEY = (userId: number | string) => `fsm:${userId}`;

export type FsmPayload = {
  state: string;
  payload?: Record<string, unknown>;
  updatedAt?: string;
};

export async function getSession(userId: number): Promise<FsmPayload | null> {
  try {
    const r = getRedis();
    const raw = await r.get(KEY(userId));
    if (!raw) return null;
    return JSON.parse(raw) as FsmPayload;
  } catch (err) {
    log.error({ err, userId }, 'getSession error');
    return null;
  }
}

export async function setState(userId: number, session: FsmPayload): Promise<void> {
  try {
    const r = getRedis();
    session.updatedAt = new Date().toISOString();
    // ioredis: set(key, value, 'EX', seconds)
    await r.set(KEY(userId), JSON.stringify(session), 'EX', TTL);
  } catch (err) {
    log.error({ err, userId, session }, 'setState error');
    throw err;
  }
}

export async function clearSession(userId: number): Promise<void> {
  try {
    const r = getRedis();
    await r.del(KEY(userId));
  } catch (err) {
    log.error({ err, userId }, 'clearSession error');
  }
}
