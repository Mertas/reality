/** Безопасная работа с localStorage (приватный режим не должен ломать сайт). */

export const LS = {
  progress: 'reality.progress.v1',
  practice: 'reality.practice.v1',
} as const;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим или квота — молча */
  }
}
