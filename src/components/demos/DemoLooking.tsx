/**
 * Демо 5 «Посмотри на то, что смотрит».
 * Перенос с js/demos.js: девяносто секунд тихого экрана, три сменяющие друг
 * друга строки, досрочное завершение и заметка, которая уходит в дневник
 * главы «Практика» (src/lib/practiceStore.ts).
 */
import { useEffect, useRef, useState } from 'react';
import {
  FadeText,
  clamp,
  mmss,
  newBox,
  token,
  useDemoEngine,
  type CanvasBox,
  type CanvasOptions,
} from './demoSupport';
import { addJournalEntry, loadPracticeState, savePracticeState } from '../../lib/practiceStore';

const CANVAS: CanvasOptions = { aspect: 0.46, minHeight: 200 };
const CANVAS_LABEL = 'Медленно пульсирующий круг';

const LEAD = 'Сядь удобно, не закрывай глаза. Ничего не ищи.';
const HINT = 'Девяносто секунд — просто смотри. Таймер идёт, пока демо на экране.';
const MSG_DEFAULT =
  'Заметка хранится только в этом браузере — она уходит в дневник главы «Практика».';
const PROMPT = 'Посмотри на то, что смотрит: 90 секунд';
const PLACEHOLDER = 'Одна-две строки: что осталось, когда ничего не искали.';

const TOTAL = 90;
const LOOK_LINES = ['Не ищи объект', 'Всё, что находится, — уже объект', 'Что не находится?'];

type Phase = 'idle' | 'run' | 'done';

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  running: boolean,
  elapsed: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const base = Math.min(w, h) * 0.26;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = token('bg2');
  ctx.fillRect(0, 0, w, h);

  const phase = running ? (elapsed % 8) / 8 : 0; // период ~8 с
  const k = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // 0 → 1 → 0
  const r = base * (0.86 + 0.28 * k);
  const alpha = running ? 0.16 + 0.28 * (1 - k) : 0.18;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = token('water');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // тихая точка в центре
  ctx.beginPath();
  ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = token('accent');
  ctx.globalAlpha = running ? 0.7 : 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function DemoLooking() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<CanvasBox>(newBox());

  const phaseRef = useRef<Phase>('idle');
  const elapsedRef = useRef(0);
  const leftRef = useRef(TOTAL);
  const lineIndexRef = useRef(-1);
  const timerRef = useRef(mmss(TOTAL));

  const [phase, setPhase] = useState<Phase>('idle');
  const [timerText, setTimerText] = useState(mmss(TOTAL));
  const [lineText, setLineText] = useState(LOOK_LINES[0]);
  const [lineOn, setLineOn] = useState(false);
  const [note, setNote] = useState('');
  const [noteLocked, setNoteLocked] = useState(false);
  const [msg, setMsg] = useState(MSG_DEFAULT);

  const draw = (): void => {
    const box = boxRef.current;
    if (!box.ctx) return;
    paint(box.ctx, box.w, box.h, phaseRef.current === 'run', elapsedRef.current);
  };

  const engine = useDemoEngine({ hostRef, canvasRef, boxRef, canvas: CANVAS, draw });

  const setLine = (i: number): void => {
    if (i === lineIndexRef.current) return;
    lineIndexRef.current = i;
    setLineText(LOOK_LINES[clamp(i, 0, LOOK_LINES.length - 1)]);
  };

  const finish = (): void => {
    if (phaseRef.current === 'done') return;
    phaseRef.current = 'done';
    setPhase('done');
    leftRef.current = 0;
    timerRef.current = mmss(0);
    setTimerText(timerRef.current);
    lineIndexRef.current = -1;
    setLineText('Время.');
    engine.stop();
    draw();
  };

  const step = (dt: number): void => {
    if (phaseRef.current !== 'run') return; // вне сеанса кадры не нужны
    elapsedRef.current += dt;
    leftRef.current = Math.max(0, TOTAL - elapsedRef.current);
    const i = Math.min(
      LOOK_LINES.length - 1,
      Math.floor(elapsedRef.current / (TOTAL / LOOK_LINES.length)),
    );
    setLine(i);
    const txt = mmss(leftRef.current);
    if (txt !== timerRef.current) {
      timerRef.current = txt;
      setTimerText(txt);
    }
    if (leftRef.current <= 0) {
      finish();
      return;
    }
    draw();
  };

  const start = (): void => {
    phaseRef.current = 'run';
    setPhase('run');
    elapsedRef.current = 0;
    leftRef.current = TOTAL;
    timerRef.current = mmss(TOTAL);
    setTimerText(timerRef.current);
    lineIndexRef.current = -1;
    setLine(0);
    setLineOn(true);
    engine.start(step);
    draw();
  };

  const lockNote = (text: string): void => {
    setNoteLocked(true);
    if (text) setNote(text);
    setLineText('Записанное останется в дневнике.');
    draw();
  };

  const save = (): void => {
    const text = note.trim();
    if (!text) {
      setMsg('Пустую заметку не сохраняем.');
      return;
    }
    let saved = false;
    try {
      savePracticeState(addJournalEntry(loadPracticeState(), PROMPT, text));
      saved = true;
    } catch {
      saved = false;
    }
    setMsg(saved ? 'Сохранено в дневник.' : 'Дневник доступен в главе «Практика».');
    lockNote(text);
  };

  const skip = (): void => {
    lockNote('');
    setMsg('Заметку не сохраняли.');
  };

  const resetLook = (): void => {
    phaseRef.current = 'idle';
    setPhase('idle');
    elapsedRef.current = 0;
    leftRef.current = TOTAL;
    timerRef.current = mmss(TOTAL);
    setTimerText(timerRef.current);
    lineIndexRef.current = -1;
    setLineOn(false);
    setLineText('');
    setNoteLocked(false);
    setNote('');
    setMsg(MSG_DEFAULT);
    engine.stop();
    draw();
  };

  // статичный круг рисуем сразу; цикл включается на время сеанса
  useEffect(() => {
    draw();
    return () => engine.stop();
  }, [engine]);

  return (
    <div className="demo demo-looking" ref={hostRef}>
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{HINT}</p>

      <div className="demo-stage">
        <canvas ref={canvasRef} className="demo-canvas" role="img" aria-label={CANVAS_LABEL} />
        <FadeText
          className={lineOn ? 'demo-stage-line demo-fade on' : 'demo-stage-line demo-fade'}
          text={lineText}
        />
        <div className="demo-stage-timer">{timerText}</div>
      </div>

      <div className="demo-row">
        {phase === 'idle' ? (
          <button type="button" className="btn btn-s" onClick={start}>
            Начать 90 секунд
          </button>
        ) : null}
        {phase === 'run' ? (
          <button type="button" className="btn-ghost btn-s" onClick={finish}>
            Завершить раньше
          </button>
        ) : null}
      </div>

      {phase === 'done' ? (
        <div className="demo-note-wrap">
          <textarea
            className="demo-textarea"
            rows={3}
            value={note}
            disabled={noteLocked}
            placeholder={PLACEHOLDER}
            aria-label="Заметка после практики"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="demo-row">
            {noteLocked ? null : (
              <button type="button" className="btn btn-s" onClick={save}>
                Сохранить в дневник
              </button>
            )}
            {noteLocked ? null : (
              <button type="button" className="btn-ghost btn-s" onClick={skip}>
                Готово без заметки
              </button>
            )}
            <button type="button" className="btn-ghost btn-s" onClick={resetLook}>
              Начать заново
            </button>
          </div>
          <p className="demo-hint">{msg}</p>
        </div>
      ) : null}
    </div>
  );
}
