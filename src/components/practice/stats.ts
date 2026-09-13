/**
 * Производные величины практики и сборка выгрузки.
 * Числа считаются по состоянию стора — честно, без «накрутки».
 */
import type { PracticeDef } from '../../data/types';
import type { PracticeState } from '../../lib/practiceStore';
import { computeStreak, dayKey, fmtDateRu, fmtTimeRu, totalDays } from '../../lib/dates';
import { plural, trim } from './texts';

/** Ключ дня ('YYYY-MM-DD') → локальная дата. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** Дни, в которых есть хотя бы одна отметка. */
export function daysWithMarks(state: PracticeState): number {
  return totalDays(state.days);
}

/** Всего отметок по всем дням. */
export function marksTotal(state: PracticeState): number {
  return Object.values(state.days).reduce((sum, day) => sum + (day.marks?.length ?? 0), 0);
}

/** Начало практики — в местной дате, а не в UTC-части ISO-строки. */
export function startKeyOf(state: PracticeState): string {
  if (!state.start) return '';
  const parsed = new Date(state.start);
  if (Number.isNaN(parsed.getTime())) {
    const short = String(state.start).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(short) ? short : '';
  }
  return dayKey(parsed);
}

export function startLabel(state: PracticeState): string {
  const key = startKeyOf(state);
  return key ? fmtDateRu(dateFromKey(key)) : '';
}

export interface PracticeStat {
  id: string;
  title: string;
  count: number;
}

/** Сколько раз отмечена каждая практика: по убыванию, затем по названию. */
export function practiceStats(state: PracticeState, practice: PracticeDef[]): PracticeStat[] {
  const counts = new Map<string, number>();
  Object.values(state.days).forEach((day) => {
    (day.marks ?? []).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  const titles = new Map(practice.map((p) => [p.id, p.title]));
  return [...counts.entries()]
    .map(([id, count]) => ({ id, title: titles.get(id) ?? id, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.title === b.title) return 0;
      return a.title < b.title ? -1 : 1;
    });
}

/** Выгрузка дневника в Markdown: шапка со статистикой, практики, записи, заметки о днях. */
export function buildMarkdown(state: PracticeState, practice: PracticeDef[]): string {
  const lines: string[] = [];
  const journal = state.journal ?? [];

  lines.push('# Дневник практики — «Это вода»');
  lines.push('');
  lines.push(`- Серия дней подряд: ${computeStreak(state.days)}`);
  lines.push(`- Всего дней с отметками: ${daysWithMarks(state)}`);
  lines.push(`- Отметок всего: ${marksTotal(state)}`);
  lines.push(`- Начало практики: ${startLabel(state) || '—'}`);
  lines.push(`- Выгружено: ${fmtTimeRu(new Date().toISOString())}`);

  lines.push('');
  lines.push('## Практики');
  lines.push('');
  const stats = practiceStats(state, practice);
  if (stats.length) {
    stats.forEach((stat) => {
      lines.push(
        `- ${stat.title} — ${stat.count} ${plural(stat.count, ['отметка', 'отметки', 'отметок'])}`,
      );
    });
  } else {
    lines.push('Отметок практик пока нет.');
  }

  lines.push('');
  lines.push('## Записи дневника');
  lines.push('');
  if (!journal.length) {
    lines.push('Записей пока нет.');
  } else {
    journal.forEach((entry) => {
      lines.push(`### ${fmtTimeRu(entry.ts)}`);
      if (entry.prompt) {
        lines.push('');
        lines.push(`*${entry.prompt}*`);
      }
      lines.push('');
      lines.push(entry.text);
      lines.push('');
    });
  }

  const notes: string[] = [];
  Object.keys(state.days)
    .sort()
    .forEach((key) => {
      const note = trim(state.days[key]?.note);
      if (note) notes.push(`- ${fmtDateRu(dateFromKey(key))} — ${note}`);
    });
  if (notes.length) {
    lines.push('## Заметки о днях');
    lines.push('');
    notes.forEach((note) => lines.push(note));
    lines.push('');
  }

  return lines.join('\n');
}
