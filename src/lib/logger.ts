import pino, { LoggerOptions } from 'pino';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Создаёт pino-логгер.
 * В dev при PINO_PRETTY=1 пробуем подключить "pino-pretty".
 * — Явно резолвим путь до модуля через createRequire (ESM-совместимо).
 * — Если модуль не найден/падает — остаёмся в JSON (fallback).
 */
export function createLogger(level: string = 'info') {
  const options: LoggerOptions = { level };
  const wantPretty = process.env.PINO_PRETTY === '1';

  if (wantPretty) {
    try {
      // Явный путь до pino-pretty (чтобы не было "unable to determine transport target")
      const prettyTarget = require.resolve('pino-pretty');

      // @ts-expect-error: поле transport слабо типизировано
      options.transport = {
        target: prettyTarget,
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname'
        }
      };
    } catch {
      // pino-pretty не установлен или не резолвится — работаем в JSON
    }
  }

  return pino(options);
}
