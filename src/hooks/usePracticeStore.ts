/**
 * React-обёртка над общим стором практики (src/lib/practiceStore.ts).
 *
 * Логика состояния живёт в сторе: здесь только подписка через useSyncExternalStore
 * и тонкие методы, которые читают текущий снимок, вызывают чистую функцию стора
 * и сохраняют результат. Никаких глобальных модульных «синглтонов состояния»:
 * кэш снимка — общий для всех экземпляров, потому что и стор общий (localStorage),
 * и он пересобирается ровно тогда, когда меняется сырая строка хранилища.
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  addJournalEntry,
  loadPracticeState,
  practiceRevision,
  resetPracticeState,
  savePracticeState,
  setDayNote,
  subscribePractice,
  toggleMark as toggleMarkInState,
  type JournalEntry,
  type PracticeState,
} from '../lib/practiceStore';
import { dayKey } from '../lib/dates';
import { LS } from '../lib/storage';

/* Снимок стора: пока не изменились ни сырая строка в localStorage, ни ревизия стора,
   отдаём тот же объект (useSyncExternalStore требует стабильного значения между
   изменениями). Ревизия нужна на случай запрета localStorage: тогда изменения живут
   в памяти стора, и сырая строка никогда не меняется. */
let snapshot: PracticeState | null = null;
let snapshotKey: string | null = null;

function rawPractice(): string | null {
  try {
    return localStorage.getItem(LS.practice);
  } catch {
    return null;
  }
}

function getSnapshot(): PracticeState {
  const key = practiceRevision() + '|' + (rawPractice() ?? '');
  if (snapshot === null || key !== snapshotKey) {
    snapshot = loadPracticeState();
    snapshotKey = key;
  }
  return snapshot;
}

function subscribe(onStoreChange: () => void): () => void {
  const unsubscribe = subscribePractice(onStoreChange);
  /* то же хранилище может изменить соседняя вкладка */
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === LS.practice) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
  };
}

/* Доступно ли локальное хранилище вообще (приватный режим, запрет записи). */
let storageProbe: boolean | null = null;

function storageAvailable(): boolean {
  if (storageProbe === null) {
    try {
      const probe = '__reality_practice_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      storageProbe = true;
    } catch {
      storageProbe = false;
    }
  }
  return storageProbe;
}

export interface PracticeStoreApi {
  state: PracticeState;
  /** false — браузер не даёт сохранять данные (покажем честное предупреждение). */
  storageOk: boolean;
  /** Отметка практики в сегодняшнем дне. Без `on` — переключить. */
  toggleMark: (practiceId: string, on?: boolean) => void;
  /** Заметка о дне (одна строка), ключ — сегодняшняя дата. */
  setNote: (note: string) => void;
  /** Добавить запись дневника. Пустой текст не сохраняется — вернётся null. */
  addEntry: (prompt: string, text: string) => JournalEntry | null;
  /** Удалить запись дневника по индексу (список хранится в порядке добавления). */
  removeEntry: (index: number) => void;
  /** Полный сброс: новая серия начинается с сегодняшнего дня. */
  reset: () => void;
}

export function usePracticeStore(): PracticeStoreApi {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const toggleMark = useCallback((practiceId: string, on?: boolean) => {
    if (!practiceId) return;
    const before = getSnapshot();
    const day = dayKey();
    const current = (before.days[day]?.marks ?? []).includes(practiceId);
    const next = on === undefined ? !current : on;
    if (next === current) return;
    savePracticeState(toggleMarkInState(before, day, practiceId));
  }, []);

  const setNote = useCallback((note: string) => {
    savePracticeState(setDayNote(getSnapshot(), dayKey(), note));
  }, []);

  const addEntry = useCallback((prompt: string, text: string): JournalEntry | null => {
    const before = getSnapshot();
    const after = addJournalEntry(before, prompt, text);
    if (after === before) return null;
    savePracticeState(after);
    return after.journal[after.journal.length - 1] ?? null;
  }, []);

  const removeEntry = useCallback((index: number) => {
    const before = getSnapshot();
    if (index < 0 || index >= before.journal.length) return;
    savePracticeState({ ...before, journal: before.journal.filter((_, i) => i !== index) });
  }, []);

  const reset = useCallback(() => {
    resetPracticeState();
  }, []);

  return {
    state,
    storageOk: storageAvailable(),
    toggleMark,
    setNote,
    addEntry,
    removeEntry,
    reset,
  };
}
