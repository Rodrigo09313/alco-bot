import 'dotenv/config';
import { z } from 'zod';

/**
 * Валидация переменных окружения.
 * — Чётко проверяем обязательные поля.
 * — Числовые поля парсим безопасно (z.coerce.number()).
 */
const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN обязателен'),

  DATABASE_URL: z.string().url('DATABASE_URL должен быть валидным URL'),
  REDIS_URL: z.string().url('REDIS_URL должен быть валидным URL'),

  DEFAULT_TZ: z.string().min(1).default('Europe/Amsterdam'),
  DEFAULT_POLL_HOUR: z.coerce.number().int().min(0).max(23).default(20),

  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace']).default('info')
});

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = EnvSchema.parse(process.env);
