/**
 * Общие средства семи React-демо («Это вода»).
 *
 * Перенос с ванильного `js/demos.js`: базовый экземпляр (цикл кадров с
 * гейтингом по видимости), canvasBox с учётом devicePixelRatio и fadeText
 * (мягкая смена текста без мигания).
 *
 * Общего изменяемого состояния здесь нет: модель каждого демо живёт в refs
 * своего компонента, поэтому два одинаковых демо на странице не конфликтуют.
 * Кэш токенов палитры — не состояние экземпляра: это разовое чтение
 * CSS-переменных, одинаковое для всех (в ванильной версии было так же).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

/* ------------------------------ числа и текст ------------------------------ */

export const MAX_DPR = 3;
export const DEG = Math.PI / 180;
export const CM_PER_PX = 2.54 / 96; // грубая оценка: 96 px на дюйм
export const VIEW_CM = 50; // экран примерно на вытянутой руке

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/** Число в русской записи: 12,3 */
export function num(value: number, digits = 1): string {
  return String(Number(value.toFixed(digits))).replace('.', ',');
}

/* --------------------------------- токены --------------------------------- */

export type TokenName =
  | 'bg'
  | 'bg2'
  | 'panel'
  | 'panel2'
  | 'ink'
  | 'inkDim'
  | 'muted'
  | 'accent'
  | 'water'
  | 'ok'
  | 'warn';

const TOKEN_VARS: Record<TokenName, string> = {
  bg: '--bg',
  bg2: '--bg-2',
  panel: '--panel',
  panel2: '--panel-2',
  ink: '--ink',
  inkDim: '--ink-dim',
  muted: '--muted',
  accent: '--accent',
  water: '--water',
  ok: '--ok',
  warn: '--warn',
};

const TOKEN_FALLBACK: Record<TokenName, string> = {
  bg: '#0a0f17',
  bg2: '#0d1522',
  panel: '#101b2b',
  panel2: '#142134',
  ink: '#e9e5da',
  inkDim: '#c2c8d4',
  muted: '#8d99ad',
  accent: '#e9c46a',
  water: '#7fb3d5',
  ok: '#8fc8a0',
  warn: '#e8a06a',
};

let themeCache: Record<TokenName, string> | null = null;

/** Цвет из CSS-токенов (палитра — публичный договор проекта). */
export function token(name: TokenName): string {
  if (!themeCache) {
    const cache = {} as Record<TokenName, string>;
    let cs: CSSStyleDeclaration | null = null;
    try {
      cs = window.getComputedStyle(document.documentElement);
    } catch {
      cs = null;
    }
    (Object.keys(TOKEN_FALLBACK) as TokenName[]).forEach((k) => {
      const v = cs ? String(cs.getPropertyValue(TOKEN_VARS[k]) || '').trim() : '';
      cache[k] = v || TOKEN_FALLBACK[k];
    });
    themeCache = cache;
  }
  return themeCache[name] || TOKEN_FALLBACK[name];
}

export function toRgb(color: string): [number, number, number] {
  const c = String(color || '').trim();
  if (c.charAt(0) === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h.slice(0, 6), 16);
    if (!isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',');
    return [parseFloat(p[0]) || 0, parseFloat(p[1]) || 0, parseFloat(p[2]) || 0];
  }
  return [0, 0, 0];
}

/** t = 0 → цвет a, t = 1 → цвет b */
export function mix(a: string, b: string, t: number): string {
  const A = toRgb(a);
  const B = toRgb(b);
  return (
    'rgb(' +
    Math.round(lerp(A[0], B[0], t)) +
    ',' +
    Math.round(lerp(A[1], B[1], t)) +
    ',' +
    Math.round(lerp(A[2], B[2], t)) +
    ')'
  );
}

/* -------------------------------- canvasBox -------------------------------- */

export interface CanvasBox {
  ctx: CanvasRenderingContext2D | null;
  /** ширина и высота в CSS-пикселях (масштаб DPR уже применён к контексту) */
  w: number;
  h: number;
  dpr: number;
}

export function newBox(): CanvasBox {
  return { ctx: null, w: 0, h: 0, dpr: 1 };
}

export interface CanvasOptions {
  /** высота = ширина × aspect */
  aspect?: number;
  /** высота как функция ширины (приоритет над aspect) */
  height?: (w: number) => number;
  minHeight?: number;
}

/* ----------------------------- цикл кадров демо ---------------------------- */

export type Step = (dt: number) => void;

export interface DemoEngine {
  /** запустить цикл: step(dt) вызывается, только пока контейнер видим */
  start: (step: Step) => void;
  /** остановить цикл (кадры прекращаются, модель остаётся) */
  stop: () => void;
  /** нарисовать текущее состояние (после смены состояния/размера) */
  repaint: () => void;
}

export interface DemoEngineConfig {
  /** корневой контейнер демо — за ним следит IntersectionObserver */
  hostRef: RefObject<HTMLDivElement>;
  canvasRef?: RefObject<HTMLCanvasElement>;
  boxRef?: MutableRefObject<CanvasBox>;
  /** параметры полотна; без них canvas не измеряется */
  canvas?: CanvasOptions;
  /** рисование текущего состояния; вызывается движком */
  draw?: () => void;
  /** полотно реально изменило размер (можно обновить подписи) */
  onResize?: () => void;
}

export function useDemoEngine(config: DemoEngineConfig): DemoEngine {
  const { hostRef, canvasRef, boxRef, canvas, draw, onResize } = config;

  // «последние» ссылки: движок всегда вызывает свежие замыкания компонента
  const drawRef = useRef<(() => void) | undefined>(undefined);
  drawRef.current = draw;
  const onResizeRef = useRef<(() => void) | undefined>(undefined);
  onResizeRef.current = onResize;

  const visibleRef = useRef(true); // до первого колбэка считаем видимым
  const stepRef = useRef<Step | null>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const deadRef = useRef(false);
  const syncRef = useRef<() => void>(() => {});
  const loopRef = useRef(false);

  if (!loopRef.current) {
    loopRef.current = true;
    const frame = (ts: number): void => {
      rafRef.current = 0;
      if (deadRef.current || !visibleRef.current) return; // ушло с экрана — тихо ждём
      const dt = lastRef.current ? Math.min((ts - lastRef.current) / 1000, 0.1) : 0;
      lastRef.current = ts;
      if (stepRef.current) stepRef.current(dt);
      if (stepRef.current && !deadRef.current && visibleRef.current) {
        rafRef.current = window.requestAnimationFrame(frame);
      }
    };
    syncRef.current = () => {
      const want = Boolean(stepRef.current) && visibleRef.current && !deadRef.current;
      if (want && !rafRef.current) {
        lastRef.current = 0;
        rafRef.current = window.requestAnimationFrame(frame);
      } else if (!want && rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }

  const start = useCallback((step: Step) => {
    stepRef.current = step;
    syncRef.current();
  }, []);

  const stop = useCallback(() => {
    stepRef.current = null;
    syncRef.current();
  }, []);

  const repaint = useCallback(() => {
    drawRef.current?.();
  }, []);

  /* видимость: анимация идёт только когда контейнер в кадре */
  useEffect(() => {
    deadRef.current = false;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      visibleRef.current = true;
      syncRef.current();
      return () => {
        deadRef.current = true;
        stepRef.current = null;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        visibleRef.current = Boolean(e.isIntersecting);
        syncRef.current();
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0 },
    );
    io.observe(host);
    return () => {
      io.disconnect();
      deadRef.current = true;
      stepRef.current = null;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [hostRef]);

  /* измерение полотна: CSS-пиксели снаружи, device-пиксели внутри */
  useEffect(() => {
    const el = canvasRef?.current;
    const box = boxRef?.current;
    if (!el || !box || !canvas) return undefined;
    const parentEl = el.parentElement ?? el;

    const measure = (): boolean => {
      const w = Math.max(200, Math.round(el.clientWidth || parentEl.clientWidth || 320));
      const h = Math.max(
        canvas.minHeight ?? 120,
        Math.round(canvas.height ? canvas.height(w) : w * (canvas.aspect ?? 0.6)),
      );
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (box.w === w && box.h === h && box.dpr === dpr && box.ctx) return false;
      box.w = w;
      box.h = h;
      box.dpr = dpr;
      el.style.height = h + 'px';
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      const ctx = el.getContext('2d');
      box.ctx = ctx;
      // дальше рисуем в CSS-пикселях
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };

    const relayout = (): void => {
      if (!measure()) return;
      drawRef.current?.();
      onResizeRef.current?.();
    };

    // observer не должен синхронно мутировать layout: иначе браузер сообщает
    // «ResizeObserver loop completed with undelivered notifications»; откладываем в rAF
    let rafId = 0;
    const schedule = (): void => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        relayout();
      });
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(parentEl);
    } else {
      window.addEventListener('resize', schedule);
    }
    relayout();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', schedule);
    };
  }, [canvasRef, boxRef, canvas]);

  return useMemo(() => ({ start, stop, repaint }), [start, stop, repaint]);
}

/* ------------------------------- fadeText --------------------------------- */

interface FadeTextProps {
  text: string;
  className?: string;
}

/** Текст с мягкой сменой без мигания (аналог fadeText из js/demos.js).
 *  Важно: таймер смены НЕ отменяется новыми значениями — иначе строка,
 *  меняющаяся чаще 150 мс (счётчик в «Гаснущих пятнах»), не обновлялась бы
 *  никогда. Ванильная версия вела себя так же: каждый вызов ставил свой
 *  таймер, а в DOM попадало последнее значение. */
export function FadeText({ text, className }: FadeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);
  const pendingRef = useRef<number | null>(null);
  const latestRef = useRef(text);

  // на размонтировании снимаем таймер
  useEffect(
    () => () => {
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current);
      pendingRef.current = null;
    },
    [],
  );

  useEffect(() => {
    latestRef.current = text;
    if (shown === text || pendingRef.current !== null) return;
    const el = ref.current;
    if (el) el.classList.add('is-fading');
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      const cur = ref.current;
      if (cur) cur.classList.remove('is-fading');
      setShown(latestRef.current);
    }, 150);
  }, [text, shown]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
