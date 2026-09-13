/**
 * Состояние приложения: посещённые главы, активная глава, навигация,
 * подсветка демо. Провайдер оборачивает весь сайт.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LS, readJson, writeJson } from '../lib/storage';

export interface ChapterDef {
  id: string;
  n: string;
  label: string;
}

export const CHAPTERS: ChapterDef[] = [
  { id: 'ch-intro', n: '0', label: 'Вода' },
  { id: 'ch-layers', n: '1', label: 'Почти теорема' },
  { id: 'ch-candidates', n: '2', label: 'Жильцы ниши' },
  { id: 'ch-routes', n: '3', label: 'Как берут невидимое' },
  { id: 'ch-skeptics', n: '4', label: 'Где всё ломается' },
  { id: 'ch-practice', n: '5', label: 'Практика' },
  { id: 'ch-sources', n: '6', label: 'Источники' },
];

interface AppState {
  visited: Record<string, true>;
  visitedCount: number;
  totalChapters: number;
  activeId: string;
  go: (id: string) => void;
  flashDemo: string | null;
  openDemo: (demoId: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [visited, setVisited] = useState<Record<string, true>>(() =>
    readJson<Record<string, true>>(LS.progress, {}),
  );
  const [activeId, setActiveId] = useState<string>('ch-intro');
  const [flashDemo, setFlashDemo] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  const markVisited = useCallback((id: string) => {
    setVisited((prev) => {
      if (prev[id]) return prev;
      const next: Record<string, true> = { ...prev, [id]: true };
      writeJson(LS.progress, next);
      return next;
    });
  }, []);

  const go = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      markVisited(id);
    },
    [markVisited],
  );

  const openDemo = useCallback(
    (demoId: string) => {
      const el = document.getElementById(`demo-${demoId}`);
      if (!el) return;
      const chapter = el.closest('.chapter');
      if (chapter && chapter.id) {
        setActiveId(chapter.id);
        markVisited(chapter.id);
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashDemo(demoId);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashDemo(null), 1700);
    },
    [markVisited],
  );

  // активная глава — по положению скролла
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setActiveId(id);
            markVisited(id);
          }
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    );
    CHAPTERS.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [markVisited]);

  const value = useMemo<AppState>(() => {
    const visitedCount = CHAPTERS.filter((c) => visited[c.id]).length;
    return {
      visited,
      visitedCount,
      totalChapters: CHAPTERS.length,
      activeId,
      go,
      flashDemo,
      openDemo,
    };
  }, [visited, activeId, go, flashDemo, openDemo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp вызван вне AppProvider');
  return ctx;
}
