/**
 * Демо 6 «Нет фона — нет фигуры».
 * Перенос с js/demos.js: фигура на фоне, слайдер уводит контраст к нулю —
 * при нуле разницы фигуру не отличить от фона.
 */
import { useEffect, useRef, useState } from 'react';
import {
  FadeText,
  clamp,
  mix,
  newBox,
  token,
  useDemoEngine,
  type CanvasBox,
  type CanvasOptions,
} from './demoSupport';

const CANVAS: CanvasOptions = { aspect: 0.5, minHeight: 200 };
const CANVAS_LABEL = 'Фигура на фоне; контраст управляется слайдером';

const LEAD = 'Фигура держится только на разнице с фоном. Уводи контраст к нулю.';
const HINT =
  'Смотри на середину сцены: при нуле разницы фигуру не отличить от фона — и это не то же самое, что «её нет».';
const NOTE_BATESON =
  'Информация — различие, которое создаёт различие (Бейтсон, 1972). Константа не несёт бит: у нулевой разницы нулевая разница.';
const NOTE_WHY =
  'Поэтому всеобщее невидимо не потому, что спрятано, а потому что не даёт дифференциальных следствий.';

function stateOf(pct: number): string {
  if (pct <= 2) return 'Различий нет: фигура совпала с фоном.';
  if (pct < 40) return 'Разница слабая: фигура угадывается с трудом.';
  return 'Фигура и фон различаются на ' + pct + '%.';
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const bg = token('bg2');

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // мягкая тень по краям — фактура сцены
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.2,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.3;

  ctx.fillStyle = mix(bg, token('water'), t);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = mix(bg, token('ink'), t);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = mix(bg, token('accent'), t);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

export function DemoContrast() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<CanvasBox>(newBox());

  const [pct, setPct] = useState(100);

  const draw = (): void => {
    const box = boxRef.current;
    if (!box.ctx) return;
    paint(box.ctx, box.w, box.h, pct / 100);
  };

  const engine = useDemoEngine({ hostRef, canvasRef, boxRef, canvas: CANVAS, draw });

  useEffect(() => {
    engine.repaint();
  }, [engine, pct]);

  return (
    <div className="demo demo-contrast" ref={hostRef}>
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{HINT}</p>

      <canvas ref={canvasRef} className="demo-canvas" role="img" aria-label={CANVAS_LABEL} />

      <div className="demo-row">
        <span className="demo-label">Контраст: {pct}%</span>
        <input
          className="demo-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          aria-label="Контраст фигуры и фона, проценты"
          onChange={(e) => setPct(clamp(Number(e.target.value) || 0, 0, 100))}
        />
      </div>

      <FadeText className="demo-readout demo-fade" text={stateOf(pct)} />

      <p className="demo-note">{NOTE_BATESON}</p>
      <p className="demo-note">{NOTE_WHY}</p>
    </div>
  );
}
