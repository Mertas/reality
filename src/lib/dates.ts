/** Даты, серии дней и «вода дня». */

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, delta: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + delta);
  return copy;
}

/** Серия подряд идущих дней с отметками, заканчивающаяся сегодня или вчера. */
export function computeStreak(
  days: Record<string, { marks?: string[] }>,
  today: Date = new Date(),
): number {
  const hasMarks = (key: string): boolean => (days[key]?.marks?.length ?? 0) > 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!hasMarks(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (hasMarks(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function totalDays(days: Record<string, { marks?: string[] }>): number {
  return Object.values(days).filter((d) => (d.marks?.length ?? 0) > 0).length;
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Строка «воды дня»: детерминированно по дате. */
export function waterOfDay(water: string[], d: Date = new Date()): string {
  if (!water.length) return '';
  return water[hashStr(dayKey(d)) % water.length];
}

export function fmtDateRu(d: Date = new Date()): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtTimeRu(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function slotByHour(hour: number = new Date().getHours()): 'morning' | 'day' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}
