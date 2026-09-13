/**
 * Демо 2 «Найди своё слепое пятно».
 * Перенос с js/demos.js: крест и точка на горизонтали, слайдер отступа,
 * подпись с углом (рабочая зона 11,5–16,5°) и отметка «Получилось».
 */
import { useEffect, useRef, useState } from 'react';
import {
  CM_PER_PX,
  DEG,
  VIEW_CM,
  clamp,
  lerp,
  newBox,
  num,
  token,
  useDemoEngine,
  type CanvasBox,
  type CanvasOptions,
} from './demoSupport';

const CANVAS: CanvasOptions = { aspect: 0.34, minHeight: 150 };
const CANVAS_LABEL = 'Крест справа и точка слева от него';

const LEAD = 'Закрой правый глаз. Левый держи на кресте — точка слева исчезнет.';
const HINT =
  'Меняй отступ медленно и не переводи взгляд на точку: она исчезает как раз тогда, когда смотришь мимо неё.';
const NOTE_ANATOMY =
  'Слепое пятно — проекция диска зрительного нерва: около 12–15° к виску от точки фиксации. Мозг достраивает пропуск, поэтому пропуск не выглядит пропуском.';
const NOTE_HOWTO =
  'Если точка не исчезает: сядь чуть дальше или ближе и веди ползунок медленно. На узком экране нужного угла может не хватить — это ограничение экрана, а не глаза.';

interface Metrics {
  offset: number;
  degrees: number;
  inZone: boolean;
}

function crossXOf(w: number): number {
  return Math.max(w * 0.76, w - 110);
}

function metricsOf(w: number, value: number): Metrics {
  const crossX = crossXOf(w);
  const maxOffset = Math.max(110, crossX - 46);
  const offset = Math.round(lerp(46, maxOffset, clamp(value / 100, 0, 1)));
  const degrees = Math.atan((offset * CM_PER_PX) / VIEW_CM) / DEG; // угол при экране ~50 см
  return { offset, degrees, inZone: degrees >= 11.5 && degrees <= 16.5 };
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, offset: number): void {
  const ink = token('ink');
  const accent = token('accent');
  const muted = token('muted');

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = token('bg2');
  ctx.fillRect(0, 0, w, h);

  const cx = crossXOf(w);
  const cy = h / 2;
  const dx = cx - offset;
  const arm = Math.max(10, Math.min(18, h * 0.09));

  // крест
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();

  // точка слева от креста
  ctx.beginPath();
  ctx.arc(dx, cy, 8, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // подписи
  ctx.fillStyle = muted;
  ctx.font = '12px system-ui, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('крест', cx, cy + arm + 18);
  ctx.fillText('точка', dx, cy + arm + 18);
}

export function DemoBlindspot() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<CanvasBox>(newBox());

  const [value, setValue] = useState(62);
  const [boxW, setBoxW] = useState(0); // ширина полотна — для подписи с углом
  const [mark, setMark] = useState<string | null>(null);

  const draw = (): void => {
    const box = boxRef.current;
    if (!box.ctx) return;
    paint(box.ctx, box.w, box.h, metricsOf(box.w, value).offset);
  };

  const engine = useDemoEngine({
    hostRef,
    canvasRef,
    boxRef,
    canvas: CANVAS,
    draw,
    onResize: () => setBoxW(boxRef.current.w),
  });

  // отступ и угол зависят от ширины полотна — перерисовываем при её смене
  useEffect(() => {
    engine.repaint();
  }, [engine, value, boxW]);

  const width = boxW || boxRef.current.w;
  const { offset, degrees, inZone } = metricsOf(width, value);

  return (
    <div className="demo demo-blindspot" ref={hostRef}>
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{HINT}</p>

      <canvas ref={canvasRef} className="demo-canvas" role="img" aria-label={CANVAS_LABEL} />

      <div className="demo-row">
        <span className="demo-label">Отступ: {offset} px</span>
        <input
          className="demo-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label="Отступ точки от креста"
          onChange={(e) => setValue(clamp(Number(e.target.value) || 0, 0, 100))}
        />
      </div>

      <div className="demo-row">
        <span className={inZone ? 'demo-readout demo-fade zone' : 'demo-readout demo-fade'}>
          {'≈ ' + num(degrees, 1) + '°' + (inZone ? ' — рабочая зона' : ' от точки фиксации')}
        </span>
        <button
          type="button"
          className="btn btn-s"
          onClick={() => setMark('Отмечено: отступ ' + offset + ' px ≈ ' + num(degrees, 1) + '°.')}
        >
          Получилось
        </button>
      </div>

      {mark ? <p className="demo-hint">{mark}</p> : null}

      <p className="demo-note">{NOTE_ANATOMY}</p>
      <p className="demo-note">{NOTE_HOWTO}</p>
    </div>
  );
}
