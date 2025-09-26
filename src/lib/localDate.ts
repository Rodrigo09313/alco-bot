// Утилита для вычисления локальной даты YYYY-MM-DD по заданной таймзоне.
// Без сторонних библиотек (Intl + ручной формат).
export function localDateYYYYMMDD(tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { // en-CA => формат YYYY-MM-DD
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // уже YYYY-MM-DD
}
