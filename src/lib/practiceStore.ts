/**
 * Общее хранилище практики: чистые функции поверх localStorage + подписка.
 * Используется UI практики (hooks/usePracticeStore) и демо (заметка «смотрящего»
 * сохраняется в дневник). Состояние — ровно как в ванильном js/practice.js:
 * ключ `reality.practice.v1`.
 *
 * Если браузер запрещает localStorage (жёсткий приватный режим), стор продолжает
 * работать в памяти до перезагрузки страницы: изменения публикуются через ревизию
 * (practiceRevision) и событие reality:practice.
 */
import { LS, readJson, writeJson } from './storage';

export interface DayEntry {
  marks: string[];
  note: string;
}

export interface JournalEntry {
  ts: string;
  prompt: string;
  text: string;
}

export interface PracticeState {
  v: 1;
  start: string;
  days: Record<string, DayEntry>;
  journal: JournalEntry[];
}

export const PRACTICE_EVENT = 'reality:practice';

/** Память на случай недоступного localStorage (живёт до перезагрузки страницы). */
let memoryState: PracticeState | null = null;

/** Ревизия состояния: растёт на каждом сохранении (нужна useSyncExternalStore,
 *  когда сырая строка localStorage не меняется — например, при запрете записи). */
let revision = 0;

export function practiceRevision(): number {
  return revision;
}

function emptyState(): PracticeState {
  return { v: 1, start: new Date().toISOString(), days: {}, journal: [] };
}

export function loadPracticeState(): PracticeState {
  const s = readJson<PracticeState | null>(LS.practice, null);
  if (!s || typeof s !== 'object' || !s.days || !Array.isArray(s.journal)) {
    return memoryState ?? emptyState();
  }
  const normalized: PracticeState = {
    v: 1,
    start: typeof s.start === 'string' ? s.start : new Date().toISOString(),
    days: s.days,
    journal: s.journal,
  };
  memoryState = normalized;
  return normalized;
}

export function savePracticeState(state: PracticeState): void {
  memoryState = state;
  revision += 1;
  writeJson(LS.practice, state);
  try {
    window.dispatchEvent(new CustomEvent(PRACTICE_EVENT));
  } catch {
    /* среда без window — молча */
  }
}

export function subscribePractice(cb: () => void): () => void {
  window.addEventListener(PRACTICE_EVENT, cb);
  return () => window.removeEventListener(PRACTICE_EVENT, cb);
}

function withDay(state: PracticeState, day: string, patch: Partial<DayEntry>): PracticeState {
  const prev: DayEntry = state.days[day] ?? { marks: [], note: '' };
  const next: DayEntry = { ...prev, ...patch };
  return { ...state, days: { ...state.days, [day]: next } };
}

export function toggleMark(state: PracticeState, day: string, practiceId: string): PracticeState {
  const entry = state.days[day] ?? { marks: [], note: '' };
  const has = entry.marks.includes(practiceId);
  const marks = has ? entry.marks.filter((m) => m !== practiceId) : [...entry.marks, practiceId];
  return withDay(state, day, { marks });
}

export function setDayNote(state: PracticeState, day: string, note: string): PracticeState {
  return withDay(state, day, { note });
}

export function addJournalEntry(state: PracticeState, prompt: string, text: string): PracticeState {
  const trimmed = text.trim();
  if (!trimmed) return state;
  const entry: JournalEntry = { ts: new Date().toISOString(), prompt, text: trimmed };
  return { ...state, journal: [...state.journal, entry] };
}

export function resetPracticeState(): PracticeState {
  const s = emptyState();
  savePracticeState(s);
  return s;
}
