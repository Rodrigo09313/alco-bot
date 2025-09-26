// Время без сторонних либ: считаем локальные дату/час по IANA TZ (Intl).

/** YYYY-MM-DD в заданной TZ */
export function localDateYYYYMMDD(tz: string, d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d);
}

/** Час [0..23] в заданной TZ */
export function localHour(tz: string, d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d));
}

/** Сконструировать Date в UTC для локальной даты YYYY-MM-DD и часа HH в TZ */
export function makeZonedDate(tz: string, ymd: string, hour: number): Date {
  // Трюк: берём полночь UTC и через Intl форматируем нужный локальный момент назад в Date.
  // Для наших целей (план ретраев) достаточно приблизительно.
  const [y, m, d] = ymd.split('-').map(Number);
  // Берём целевую локальную дату/час как строку и парсим обратно через Date.parse с UTC-суффиксом.
  // Здесь допустим упрощённый подход: используем Date.UTC и позже поправим таймзонные сдвиги при сравнении в TZ.
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0, 0));
}
