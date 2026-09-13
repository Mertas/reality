/**
 * Демо 4 «Нети нети».
 * Перенос с js/demos.js: семь чипсов-содержаний, каждый убирается один раз,
 * соответствующая деталь сцены гаснет; когда убрано всё — финальная панель
 * и кнопка «Вернуть всё».
 */
import { useEffect, useRef, useState } from 'react';
import {
  clamp,
  newBox,
  token,
  useDemoEngine,
  type CanvasBox,
  type CanvasOptions,
} from './demoSupport';

const CANVAS: CanvasOptions = { aspect: 0.52, minHeight: 200 };
const CANVAS_LABEL = 'Полотно сцены: цвет, звук, мысль, эмоция, тело, «я» и мир';

const LEAD = 'Убирай по одному. После каждого остатка смотри, что осталось.';
const HINT =
  'Это упрощённая форма практики «нети нети» — способ не добавлять знание, а отнимать всё переменное.';
const FINAL_TEXT =
  'Осталось то, чем всё это замечалось. Попробуй убрать и его — но чем ты это увидишь?';
const NOTE =
  '«нети нети» — «не это, не это»: так в традиции описывают то, что описанию не поддаётся (Бр.-уп. 2.3.6: лучшего описания нет). Строки здесь — спокойный пересказ этого хода, не цитаты.';

interface Layer {
  id: string;
  chip: string;
  say: string;
}

const NETI: Layer[] = [
  { id: 'color', chip: 'Цвет', say: 'не это: цвет замечается — значит, он содержимое, а не замечающий.' },
  { id: 'sound', chip: 'Звук', say: 'не это: звук приходит и уходит, а замечание остаётся.' },
  { id: 'think', chip: 'Мысль', say: 'не это: мысль — гость, а не хозяин.' },
  { id: 'feel', chip: 'Эмоция', say: 'не это: состояние меняется, а то, чем оно замечено, — нет.' },
  { id: 'body', chip: 'Тело', say: 'не это: тело тоже видно — как и всё остальное.' },
  { id: 'self', chip: '«Я»', say: 'не это: «я» здесь — ещё одно представление, которое можно убрать.' },
  { id: 'world', chip: 'Мир', say: 'не это: мир — то, что предъявлено. Не то, чем предъявлено.' },
];

interface Model {
  alpha: Record<string, number>;
  target: Record<string, number>;
  removed: Record<string, boolean>;
  t: number;
}

function newModel(): Model {
  const alpha: Record<string, number> = {};
  const target: Record<string, number> = {};
  const removed: Record<string, boolean> = {};
  NETI.forEach((l) => {
    alpha[l.id] = 1;
    target[l.id] = 1;
    removed[l.id] = false;
  });
  return { alpha, target, removed, t: 0 };
}

function alphaOf(model: Model, id: string): number {
  const v = model.alpha[id];
  return clamp(v == null ? 0 : v, 0, 1);
}

/* --- рисование сцены: семь слоёв, каждый со своей прозрачностью --- */

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, model: Model): void {
  const cx = w / 2;
  const cy = h * 0.62;
  const scale = clamp(Math.min(w, h) / 260, 0.75, 2);
  const t = model.t;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = token('bg2');
  ctx.fillRect(0, 0, w, h);

  // цвет — мягкие пятна по всему полотну
  const ac = alphaOf(model, 'color');
  if (ac > 0.01) {
    ctx.save();
    ctx.globalAlpha = ac * 0.5;
    const g1 = ctx.createRadialGradient(w * 0.28, h * 0.3, 4, w * 0.28, h * 0.3, w * 0.42);
    g1.addColorStop(0, token('water'));
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);
    const g2 = ctx.createRadialGradient(w * 0.74, h * 0.66, 4, w * 0.74, h * 0.66, w * 0.36);
    g2.addColorStop(0, token('accent'));
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // мир — линия горизонта и земля
  const aw = alphaOf(model, 'world');
  if (aw > 0.01) {
    ctx.save();
    ctx.globalAlpha = aw * 0.65;
    ctx.strokeStyle = 'rgba(233,229,218,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, cy + 46 * scale);
    ctx.lineTo(w * 0.94, cy + 46 * scale);
    ctx.stroke();
    ctx.fillStyle = 'rgba(233,229,218,.05)';
    ctx.fillRect(0, cy + 46 * scale, w, h - (cy + 46 * scale));
    ctx.restore();
  }

  // тело — простой силуэт
  const ab = alphaOf(model, 'body');
  if (ab > 0.01) {
    ctx.save();
    ctx.globalAlpha = ab * 0.9;
    ctx.strokeStyle = token('inkDim');
    ctx.lineWidth = 2;
    const bh = 40 * scale;
    const bw = 22 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, cy + bh); // корпус
    ctx.lineTo(cx - bw / 2, cy + 6 * scale);
    ctx.moveTo(cx + bw / 2, cy + bh);
    ctx.lineTo(cx + bw / 2, cy + 6 * scale);
    ctx.moveTo(cx - bw / 2, cy + bh);
    ctx.lineTo(cx + bw / 2, cy + bh);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 6 * scale, 11 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // эмоция — тёплый круг, который дышит
  const af = alphaOf(model, 'feel');
  if (af > 0.01) {
    ctx.save();
    const pulse = 1 + Math.sin(t * 1.6) * 0.12;
    ctx.globalAlpha = af * (0.45 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.6)));
    const g3 = ctx.createRadialGradient(cx, cy + 14 * scale, 2, cx, cy + 14 * scale, 26 * scale * pulse);
    g3.addColorStop(0, token('warn'));
    g3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.arc(cx, cy + 14 * scale, 26 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // мысль — облачко точек над головой
  const at = alphaOf(model, 'think');
  if (at > 0.01) {
    ctx.save();
    ctx.globalAlpha = at * 0.75;
    ctx.fillStyle = token('inkDim');
    for (let i = 0; i < 4; i++) {
      const px = cx + 18 * scale + Math.cos(t * 0.6 + i * 1.7) * 12 * scale;
      const py = cy - 30 * scale + Math.sin(t * 0.5 + i * 2.1) * 8 * scale;
      ctx.beginPath();
      ctx.arc(px, py, (3.2 + i * 0.7) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // звук — расходящиеся дуги
  const as = alphaOf(model, 'sound');
  if (as > 0.01) {
    ctx.save();
    ctx.strokeStyle = token('water');
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const rr = (16 + k * 9 + ((t * 14) % 9)) * scale;
      ctx.globalAlpha = as * 0.45 * (1 - k * 0.25);
      ctx.beginPath();
      ctx.arc(cx - 26 * scale, cy - 6 * scale, rr, Math.PI * 0.62, Math.PI * 1.38);
      ctx.stroke();
    }
    ctx.restore();
  }

  // «я» — маленькая яркая точка с ореолом
  const aself = alphaOf(model, 'self');
  if (aself > 0.01) {
    ctx.save();
    ctx.globalAlpha = aself;
    const g4 = ctx.createRadialGradient(cx, cy - 6 * scale, 0, cx, cy - 6 * scale, 16 * scale);
    g4.addColorStop(0, token('accent'));
    g4.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g4;
    ctx.beginPath();
    ctx.arc(cx, cy - 6 * scale, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - 6 * scale, 2.6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = aself * 0.9;
    ctx.fill();
    ctx.restore();
  }
}

/* -------------------------------- компонент ------------------------------- */

export function DemoNetiNeti() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<CanvasBox>(newBox());

  const [model] = useState<Model>(newModel);
  const [logIds, setLogIds] = useState<string[]>([]);

  const draw = (): void => {
    const box = boxRef.current;
    if (!box.ctx) return;
    paint(box.ctx, box.w, box.h, model);
  };

  const engine = useDemoEngine({ hostRef, canvasRef, boxRef, canvas: CANVAS, draw });

  const step = (dt: number): void => {
    model.t += dt;
    NETI.forEach((l) => {
      const a = model.alpha[l.id];
      const a2 = model.target[l.id];
      model.alpha[l.id] = a + (a2 - a) * (1 - Math.exp(-dt / 0.7));
    });
    draw();
  };

  useEffect(() => {
    engine.start(step);
    draw();
    return () => engine.stop();
    // step/draw читают только модель и refs
  }, [engine]);

  const remove = (id: string): void => {
    if (model.removed[id]) return;
    model.removed[id] = true;
    model.target[id] = 0;
    setLogIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const restore = (): void => {
    NETI.forEach((l) => {
      model.removed[l.id] = false;
      model.target[l.id] = 1;
    });
    setLogIds([]);
  };

  const allRemoved = logIds.length === NETI.length;

  return (
    <div className="demo demo-netineti" ref={hostRef}>
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{HINT}</p>

      <div className="demo-chips">
        {NETI.map((l) => {
          const gone = model.removed[l.id];
          return (
            <button
              key={l.id}
              type="button"
              className="demo-chip"
              data-layer={l.id}
              aria-pressed={gone}
              disabled={gone}
              onClick={() => remove(l.id)}
            >
              {l.chip}
            </button>
          );
        })}
      </div>

      <canvas ref={canvasRef} className="demo-canvas" role="img" aria-label={CANVAS_LABEL} />

      <ul className="demo-log">
        {logIds.map((id) => {
          const layer = NETI.find((l) => l.id === id);
          if (!layer) return null;
          return (
            <li key={id} className="demo-log-item">
              <b>{layer.chip}</b>
              {' — ' + layer.say}
            </li>
          );
        })}
      </ul>

      {allRemoved ? (
        <div className="demo-final">
          <p>{FINAL_TEXT}</p>
          <div className="demo-row">
            <button type="button" className="btn-ghost btn-s" onClick={restore}>
              Вернуть всё
            </button>
          </div>
        </div>
      ) : null}

      <p className="demo-note">{NOTE}</p>
    </div>
  );
}
