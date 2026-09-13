/**
 * Демо 1 «Гаснущие пятна» (эффект Трокслера).
 * Перенос с js/demos.js: крест фиксации и десять пятен; пятна гаснут, пока
 * взгляд (мышь/палец/клавиши) неподвижен, и возвращаются от движения.
 */
import { useEffect, useRef, useState } from 'react';
import {
  DEG,
  FadeText,
  clamp,
  newBox,
  num,
  token,
  useDemoEngine,
  type CanvasBox,
  type CanvasOptions,
} from './demoSupport';

const CANVAS: CanvasOptions = { aspect: 0.52, minHeight: 220 };
const CANVAS_LABEL = 'Крест в центре, вокруг — десять цветных пятен';

const LEAD = 'Зафиксируй взгляд на кресте и не двигай глазами.';
const HINT =
  'Периферийные пятна гаснут, если взгляд стоит. Движение мыши — грубая замена движению глаз: сдвинул мышь — пятна вернулись.';
const NOTE = 'Упрощённая реплика; оригинал — эффект Трокслера, 1804.';

/* Десять пятен вокруг центра: внешнее кольцо и внутреннее. */
const DOTS = [
  { a: 10, r: 1.0, s: 9, c: '#7fb3d5' },
  { a: 70, r: 1.0, s: 8, c: '#e9c46a' },
  { a: 130, r: 1.0, s: 10, c: '#8fc8a0' },
  { a: 190, r: 1.0, s: 8, c: '#e8a06a' },
  { a: 250, r: 1.0, s: 9, c: '#b7a4d6' },
  { a: 310, r: 1.0, s: 8, c: '#7fb3d5' },
  { a: 40, r: 0.56, s: 7, c: '#e9c46a' },
  { a: 130, r: 0.56, s: 7, c: '#8fc8a0' },
  { a: 220, r: 0.56, s: 7, c: '#e8a06a' },
  { a: 310, r: 0.56, s: 7, c: '#b7a4d6' },
];

function statusOf(fade: number, idle: number, delay: number): string {
  const state =
    fade < 0.05 ? 'погасли' : fade < 0.9 ? (idle >= delay ? 'гаснут' : 'возвращаются') : 'видны';
  return 'Пятна: ' + state + ' · без движения ' + num(idle, 1) + ' с';
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, fade: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = token('bg2');
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w * 0.36, h * 0.42);
  const scale = clamp(w / 620, 0.7, 1.6);

  ctx.globalAlpha = fade;
  DOTS.forEach((d) => {
    const a = (d.a - 90) * DEG;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R * d.r, cy + Math.sin(a) * R * d.r, Math.max(6, d.s * scale), 0, Math.PI * 2);
    ctx.fillStyle = d.c;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // крест — точка фиксации, она не гаснет
  const arm = Math.max(12, 15 * scale);
  ctx.strokeStyle = token('ink');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = token('accent');
  ctx.fill();
}

export function DemoTroxler() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<CanvasBox>(newBox());

  const idleRef = useRef(0); // секунд без движения
  const fadeRef = useRef(1); // 1 — пятна видны, 0 — погасли

  const [delay, setDelay] = useState(20);
  const delayRef = useRef(delay);
  delayRef.current = delay;

  const [status, setStatus] = useState(() => statusOf(1, 0, 20));

  const draw = (): void => {
    const box = boxRef.current;
    if (!box.ctx) return;
    paint(box.ctx, box.w, box.h, fadeRef.current);
  };

  const engine = useDemoEngine({ hostRef, canvasRef, boxRef, canvas: CANVAS, draw });

  const updateStatus = (): void => {
    const text = statusOf(fadeRef.current, idleRef.current, delayRef.current);
    setStatus((prev) => (prev === text ? prev : text));
  };

  const step = (dt: number): void => {
    idleRef.current += dt;
    const d = delayRef.current;
    const target = idleRef.current >= d ? 0 : 1;
    const tau = target > fadeRef.current ? 0.4 : 1.3; // возврат быстрый, угасание медленное
    fadeRef.current += (target - fadeRef.current) * (1 - Math.exp(-dt / tau));
    updateStatus();
    draw();
  };

  // цикл идёт всё время, пока контейнер видим
  useEffect(() => {
    engine.start(step);
    draw();
    return () => engine.stop();
    // step/draw читают только refs — перезапуск не нужен
  }, [engine]);

  // любое движение сбрасывает счётчик неподвижности
  useEffect(() => {
    const activity = (): void => {
      idleRef.current = 0;
    };
    const host = hostRef.current;
    document.addEventListener('pointermove', activity);
    document.addEventListener('pointerdown', activity);
    document.addEventListener('keydown', activity);
    host?.addEventListener('touchmove', activity);
    window.addEventListener('scroll', activity, true);
    return () => {
      document.removeEventListener('pointermove', activity);
      document.removeEventListener('pointerdown', activity);
      document.removeEventListener('keydown', activity);
      host?.removeEventListener('touchmove', activity);
      window.removeEventListener('scroll', activity, true);
    };
  }, []);

  const reset = (): void => {
    idleRef.current = 0;
    fadeRef.current = 1;
    updateStatus();
    draw();
  };

  return (
    <div className="demo demo-troxler" ref={hostRef}>
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{HINT}</p>

      <canvas ref={canvasRef} className="demo-canvas" role="img" aria-label={CANVAS_LABEL} />

      <div className="demo-row">
        <span className="demo-label">Время без движения до угасания: {delay} с</span>
        <input
          className="demo-slider"
          type="range"
          min={5}
          max={40}
          step={1}
          value={delay}
          aria-label="Время без движения до угасания, секунды"
          onChange={(e) => setDelay(clamp(Number(e.target.value) || 20, 5, 40))}
        />
      </div>

      <div className="demo-row">
        <FadeText className="demo-readout demo-fade" text={status} />
        <button type="button" className="btn-ghost btn-s" onClick={reset}>
          Начать заново
        </button>
      </div>

      <p className="demo-note">{NOTE}</p>
    </div>
  );
}
