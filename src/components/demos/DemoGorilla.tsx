/**
 * Демо 3 «Горилла» (Саймонс—Чабрис, 1999).
 * Перенос с js/demos.js: четыре фигуры перебрасывают два мяча, счёт передач
 * светлой команды, проход гориллы, два вопроса после раунда, результат
 * с числами и повтор с подсказкой (0,6×, горилла подсвечена).
 *
 * Модель раунда живёт в мутабельном объекте (useState с ленивым стартом),
 * чтобы цикл кадров читал её без пересозданий; в состояние React выносится
 * только то, что видно на экране.
 */
import { useEffect, useRef, useState } from 'react';
import {
  clamp,
  lerp,
  mmss,
  newBox,
  token,
  useDemoEngine,
  type CanvasBox,
  type CanvasOptions,
} from './demoSupport';

const CANVAS: CanvasOptions = { aspect: 0.56, minHeight: 230 };
const CANVAS_LABEL = 'Четыре фигуры перебрасывают два мяча по сцене';

const LEAD = 'Считай передачи светлой команды.';
const HINT =
  'Светлые перебрасывают мяч между собой, тёмные — между собой. Считай передачи светлых.';
const NOTE =
  'Саймонс—Чабрис, 1999: 46% не замечают; ни один из незаметивших не «вспомнил» гориллу, пока запись не прокрутили заново. Это демонстрация «второй модели»: прозрачное становится видимым не всматриванием, а вторым набором данных для сверки.';

type Team = 'light' | 'dark';
type Phase = 'idle' | 'round' | 'gorilla' | 'done';

interface Figure {
  team: Team;
  x: number;
  y: number;
  tx: number;
  ty: number;
  v: number;
}

interface Flight {
  to: number;
  t: number;
  dur: number;
  fx: number;
  fy: number;
}

interface Passing {
  owner: number;
  nextAt: number;
  flight: Flight | null;
}

interface Gorilla {
  x: number;
  y: number;
  vx: number;
}

interface Model {
  figures: Figure[];
  passing: Record<Team, Passing>;
  gorilla: Gorilla | null;
  gorillaSeen: boolean;
  t: number;
  lightPasses: number;
  darkPasses: number;
  passTarget: number;
  phase: Phase;
  hinted: boolean;
  speed: number;
}

interface Snapshot {
  passes: number;
  count: number;
  noticed: boolean;
  gorillaSeen: boolean;
}

function newModel(): Model {
  return {
    figures: [
      { team: 'light', x: 0.28, y: 0.32, tx: 0.34, ty: 0.28, v: 0.085 },
      { team: 'light', x: 0.42, y: 0.68, tx: 0.4, ty: 0.74, v: 0.075 },
      { team: 'dark', x: 0.74, y: 0.36, tx: 0.7, ty: 0.4, v: 0.09 },
      { team: 'dark', x: 0.62, y: 0.74, tx: 0.66, ty: 0.7, v: 0.08 },
    ],
    // у каждой команды свой мяч
    passing: {
      light: { owner: 0, nextAt: 1.0, flight: null },
      dark: { owner: 2, nextAt: 0.6, flight: null },
    },
    gorilla: null,
    gorillaSeen: false,
    t: 0,
    lightPasses: 0,
    darkPasses: 0,
    passTarget: 9,
    phase: 'idle',
    hinted: false,
    speed: 1,
  };
}

function resetFigures(model: Model): void {
  const fresh = newModel();
  model.figures = fresh.figures;
  model.passing = fresh.passing;
  model.gorilla = null;
  model.gorillaSeen = false;
  model.t = 0;
  model.lightPasses = 0;
  model.darkPasses = 0;
}

function moveFigures(model: Model, s: number): void {
  model.figures.forEach((f) => {
    const dx = f.tx - f.x;
    const dy = f.ty - f.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.03) {
      f.tx = 0.12 + Math.random() * 0.76;
      f.ty = 0.14 + Math.random() * 0.72;
    } else {
      const k = f.v * (f.team === 'dark' ? 1.15 : 1) * s;
      f.x += (dx / d) * k;
      f.y += (dy / d) * k;
    }
    f.x = clamp(f.x, 0.07, 0.93);
    f.y = clamp(f.y, 0.12, 0.88);
  });

  // слегка разводим фигуры, чтобы не сливались
  const figs = model.figures;
  for (let i = 0; i < figs.length; i++) {
    for (let j = i + 1; j < figs.length; j++) {
      const a = figs[i];
      const b = figs[j];
      const ddx = b.x - a.x;
      const ddy = b.y - a.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
      if (dist < 0.17) {
        const push = (0.17 - dist) / 2;
        a.x -= (ddx / dist) * push;
        a.y -= (ddy / dist) * push;
        b.x += (ddx / dist) * push;
        b.y += (ddy / dist) * push;
      }
    }
  }
}

function passBall(model: Model, team: Team, s: number): void {
  const p = model.passing[team];
  if (p.flight) {
    p.flight.t += s / p.flight.dur;
    if (p.flight.t >= 1) {
      p.owner = p.flight.to;
      p.flight = null;
      p.nextAt = model.t + 0.5 + Math.random() * 0.5;
      if (team === 'light') model.lightPasses++;
      else model.darkPasses++;
    }
    return;
  }
  if (model.t < p.nextAt) return;
  const from = p.owner;
  const mates: number[] = [];
  for (let i = 0; i < model.figures.length; i++) {
    if (i !== from && model.figures[i].team === team) mates.push(i);
  }
  if (!mates.length) return;
  const to = mates[Math.floor(Math.random() * mates.length)];
  p.flight = {
    to,
    t: 0,
    dur: 0.5 + Math.random() * 0.25,
    fx: model.figures[from].x,
    fy: model.figures[from].y,
  };
  p.owner = to;
}

function startGorilla(model: Model): void {
  model.phase = 'gorilla';
  model.gorillaSeen = true;
  model.gorilla = { x: -0.12, y: 0.45, vx: 1.24 / 5 }; // проходит сцену за ~5 с
}

/* ---------------------------- рисование сцены ----------------------------- */

function figureRadius(w: number, h: number): number {
  return clamp(Math.min(w, h) * 0.058, 11, 20);
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, model: Model): void {
  const light = token('ink');
  const accent = token('accent');
  const dark = '#33465e';
  const r = figureRadius(w, h);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = token('bg2');
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(233,229,218,.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  const px = (f: Figure): { x: number; y: number } => ({ x: f.x * w, y: f.y * h });

  // фигуры
  model.figures.forEach((f) => {
    const at = px(f);
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.fillStyle = f.team === 'light' ? light : dark;
    ctx.fill();
    if (f.team === 'dark') {
      ctx.strokeStyle = 'rgba(233,229,218,.28)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // мячи
  (['light', 'dark'] as Team[]).forEach((team) => {
    const p = model.passing[team];
    if (!p) return;
    let pos: { x: number; y: number } | null = null;
    if (p.flight) {
      const to = model.figures[p.flight.to];
      const t = clamp(p.flight.t, 0, 1);
      const arc = Math.sin(Math.PI * t) * 0.055;
      pos = {
        x: lerp(p.flight.fx, to.x, t) * w,
        y: (lerp(p.flight.fy, to.y, t) - arc) * h,
      };
    } else {
      const owner = model.figures[p.owner];
      if (!owner) return;
      const o = px(owner);
      pos = { x: o.x + r * 0.95, y: o.y - r * 0.95 };
    }
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, Math.max(4, r * 0.42), 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  });

  // горилла: тёмная фигура с контуром
  const g = model.gorilla;
  if (g) {
    const gx = g.x * w;
    const gy = (g.y + Math.sin(model.t * 7) * 0.012) * h;
    const gr = r * 1.45;
    const hint = model.hinted;

    if (hint) {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fillStyle = '#182534';
    ctx.fill();
    ctx.lineWidth = hint ? 2.5 : 1.8;
    ctx.strokeStyle = hint ? accent : 'rgba(233,229,218,.6)';
    ctx.stroke();

    // уши
    ctx.beginPath();
    ctx.arc(gx - gr * 0.85, gy - gr * 0.72, gr * 0.34, 0, Math.PI * 2);
    ctx.arc(gx + gr * 0.85, gy - gr * 0.72, gr * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = '#182534';
    ctx.fill();
    ctx.stroke();

    // лапы
    ctx.beginPath();
    ctx.moveTo(gx - gr * 0.55, gy + gr * 0.72);
    ctx.lineTo(gx - gr * 0.95, gy + gr * 1.25);
    ctx.moveTo(gx + gr * 0.55, gy + gr * 0.72);
    ctx.lineTo(gx + gr * 0.95, gy + gr * 1.25);
    ctx.stroke();
    if (hint) ctx.restore();

    if (hint) {
      ctx.fillStyle = accent;
      ctx.font = '12px system-ui, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('горилла', gx, gy - gr - 8);
    }
  }
}

/* -------------------------------- компонент ------------------------------- */

export function DemoGorilla() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<CanvasBox>(newBox());

  const [model] = useState<Model>(newModel);

  const [statusText, setStatusText] = useState(HINT);
  const [startLabel, setStartLabel] = useState('Начать раунд');
  const [panelMode, setPanelMode] = useState<'none' | 'questions' | 'results'>('none');
  const [early, setEarly] = useState(false);
  const [noticed, setNoticed] = useState<boolean | null>(null);
  const [countRaw, setCountRaw] = useState('');
  const [warn, setWarn] = useState('');
  const [result, setResult] = useState<Snapshot | null>(null);

  const draw = (): void => {
    const box = boxRef.current;
    if (!box.ctx) return;
    paint(box.ctx, box.w, box.h, model);
  };

  const engine = useDemoEngine({ hostRef, canvasRef, boxRef, canvas: CANVAS, draw });

  const updateStatus = (): void => {
    let text: string;
    if (model.phase === 'round') {
      text = 'Раунд идёт · ' + mmss(model.t) + ' · считай передачи светлой команды.';
    } else if (model.phase === 'gorilla') {
      text = model.hinted
        ? 'Повтор (0,6×) · горилла подсвечена · светлых передач: ' + model.lightPasses
        : 'Раунд идёт · ' + mmss(model.t) + ' · считай передачи светлой команды.';
    } else {
      return;
    }
    // без плавного затухания: строка меняется часто
    setStatusText((prev) => (prev === text ? prev : text));
  };

  const step = (dt: number): void => {
    if (model.phase !== 'round' && model.phase !== 'gorilla') return;
    const s = dt * model.speed;
    model.t += s;
    moveFigures(model, s);
    passBall(model, 'light', s);
    passBall(model, 'dark', s);

    if (model.phase === 'round' && (model.lightPasses >= model.passTarget || (model.t > 40 && model.lightPasses >= 4))) {
      startGorilla(model);
    }
    if (model.gorilla) {
      model.gorilla.x += model.gorilla.vx * s;
      if (model.gorilla.x > 1.14) {
        model.gorilla = null;
        finishRound(false);
        return;
      }
    }
    updateStatus();
    draw();
  };

  const startRound = (hint: boolean): void => {
    model.hinted = hint;
    model.speed = hint ? 0.6 : 1;
    model.phase = 'round';
    model.passTarget = 8 + Math.floor(Math.random() * 3); // 8–10 передач светлых
    resetFigures(model);
    setStartLabel('Завершить раунд');
    setStatusText('Раунд идёт. Считай передачи светлой команды.');
    setPanelMode('none');
    setResult(null);
    setNoticed(null);
    setCountRaw('');
    setWarn('');
    engine.start(step);
    draw();
  };

  const finishRound = (earlyFinish: boolean): void => {
    model.phase = 'done';
    engine.stop();
    setStartLabel('Заново');
    setStatusText(
      earlyFinish
        ? 'Раунд завершён досрочно. Осталось ответить на два вопроса.'
        : 'Раунд закончен. Осталось ответить на два вопроса.',
    );
    setEarly(earlyFinish);
    setNoticed(null);
    setCountRaw('');
    setWarn('');
    setPanelMode('questions');
    draw();
  };

  const onStartClick = (): void => {
    if (model.phase === 'round' || model.phase === 'gorilla') finishRound(true);
    else startRound(false);
  };

  const check = (): void => {
    const raw = countRaw.trim();
    if (noticed === null || raw === '') {
      setWarn('Ответьте на оба вопроса.');
      return;
    }
    const count = Math.max(0, Math.round(Number(raw) || 0));
    setResult({
      passes: model.lightPasses,
      count,
      noticed,
      gorillaSeen: model.gorillaSeen,
    });
    setPanelMode('results');
  };

  // в покое раунда нет — цикл не запускаем, только рисуем стартовую сцену
  useEffect(() => {
    draw();
    return () => engine.stop();
  }, [engine]);

  const delta = result ? result.count - result.passes : 0;
  const deltaText = delta === 0 ? 'точно' : delta > 0 ? 'лишних ' + delta : 'не хватает ' + -delta;

  return (
    <div className="demo demo-gorilla" ref={hostRef}>
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{statusText}</p>

      <canvas ref={canvasRef} className="demo-canvas" role="img" aria-label={CANVAS_LABEL} />

      <div className="demo-row">
        <button type="button" className="btn btn-s" onClick={onStartClick}>
          {startLabel}
        </button>
      </div>

      {panelMode === 'questions' ? (
        <div className="demo-final">
          <p className="demo-final-lead">{early ? 'Раунд закончен досрочно.' : 'Раунд закончен.'}</p>

          <p className="demo-q">Заметили ли вы что-нибудь необычное в сцене?</p>
          <div className="demo-row">
            <button
              type="button"
              className="demo-opt"
              aria-pressed={noticed === true}
              onClick={() => setNoticed(true)}
            >
              Да
            </button>
            <button
              type="button"
              className="demo-opt"
              aria-pressed={noticed === false}
              onClick={() => setNoticed(false)}
            >
              Нет
            </button>
          </div>

          <p className="demo-q">Сколько передач светлой команды вы насчитали?</p>
          <div className="demo-row">
            <input
              className="demo-num"
              type="number"
              min={0}
              max={99}
              value={countRaw}
              aria-label="Сколько передач светлой команды вы насчитали"
              onChange={(e) => setCountRaw(e.target.value)}
            />
          </div>

          <div className="demo-row">
            <button type="button" className="btn btn-s" onClick={check}>
              Проверить
            </button>
          </div>

          <p className="demo-hint">{warn}</p>
        </div>
      ) : null}

      {panelMode === 'results' && result ? (
        <div className="demo-final">
          <p className="demo-final-lead">{'Светлая команда сделала передач: ' + result.passes + '.'}</p>
          <p>
            {result.gorillaSeen
              ? 'Через сцену прошла горилла — около пяти секунд.'
              : 'Раунд закончился раньше, чем в сцене успела появиться горилла.'}
          </p>
          <p>{'Ваш счёт: ' + result.count + ' (' + deltaText + ').'}</p>
          <p>
            {result.noticed
              ? 'Вы ответили, что необычное заметили. В исследовании 1999 года гориллу замечали 54% наблюдателей.'
              : 'Вы ответили, что необычного не заметили. В исследовании 1999 года гориллу не заметили 46% из 192 наблюдателей.'}
          </p>
          {result.gorillaSeen && !result.noticed ? (
            <p>Ни один из незаметивших не «вспомнил» гориллу, пока запись не прокрутили заново.</p>
          ) : null}
          <div className="demo-row">
            <button type="button" className="btn btn-s" onClick={() => startRound(true)}>
              Повтор с подсказкой
            </button>
            <button type="button" className="btn-ghost btn-s" onClick={() => startRound(false)}>
              Заново
            </button>
          </div>
        </div>
      ) : null}

      <p className="demo-note">{NOTE}</p>
    </div>
  );
}
