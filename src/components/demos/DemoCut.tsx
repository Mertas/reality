/**
 * Демо 7 «Разрез фон Неймана».
 * Перенос с js/demos.js: горизонтальная цепь атом → прибор → глаз → мозг →
 * сознание → ?, слайдер двигает разрез, подпись под цепью меняется.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { FadeText, clamp } from './demoSupport';

const LEAD = 'Где происходит «коллапс»? Проведи разрез по цепи и посмотри, что скажет физика.';
const HINT = 'Разрез можно поставить в любую точку цепи — вопрос в том, оставляет ли физика здесь выбор.';
const NOTE =
  'Предохранитель от мистики: Вигнер — автор гипотезы «сознание вызывает коллапс» — сам от неё отказался (декогеренция, Це, 1970).';

const CUT_NODES = ['атом', 'прибор', 'глаз', 'мозг', 'сознание', '?'];
const CUT_WORDS = [
  'перед атомом',
  'атом → прибор',
  'прибор → глаз',
  'глаз → мозг',
  'мозг → сознание',
  'сознание → ?',
  'за «?»',
];
const LAST = CUT_WORDS.length - 1; // 6 — разрез за «?»

/** подсветка ближайших к разрезу узлов */
function isNear(i: number, pos: number): boolean {
  return (
    (pos === 0 && i === 0) ||
    (pos === LAST && i === CUT_NODES.length - 1) ||
    i === pos - 1 ||
    i === pos
  );
}

function captionOf(pos: number): string {
  if (pos >= LAST) return 'физика не указывает место — разрез задаём мы';
  if (pos === LAST - 1) return 'или здесь?';
  return 'здесь?';
}

export function DemoCut() {
  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stopsRef = useRef<number[]>([]);
  const posRef = useRef(3);

  const [pos, setPos] = useState(3);
  const [markLeft, setMarkLeft] = useState<number | null>(null);

  const place = useCallback((next: number) => {
    const stops = stopsRef.current;
    if (!stops.length) return;
    const p = clamp(Math.round(next), 0, stops.length - 1);
    posRef.current = p;
    setPos(p);

    const x = stops[p];
    setMarkLeft(x - 1);

    // держим разрез в видимой части прокручиваемой цепи
    const frame = frameRef.current;
    if (frame && frame.scrollWidth > frame.clientWidth + 2) {
      if (x < frame.scrollLeft + 24 || x > frame.scrollLeft + frame.clientWidth - 24) {
        frame.scrollLeft = clamp(x - frame.clientWidth / 2, 0, frame.scrollWidth - frame.clientWidth);
      }
    }
  }, []);

  /* Границы между узлами — координаты возможных положений разреза. */
  const layout = useCallback(() => {
    const track = trackRef.current;
    const nodes = nodeRefs.current;
    if (!track || nodes.length === 0 || nodes.some((n) => n === null)) return;
    const tRect = track.getBoundingClientRect();
    if (!tRect.width) return;
    const boxes = nodes.map((n) => (n as HTMLSpanElement).getBoundingClientRect());
    const stops: number[] = [];
    stops.push(boxes[0].left - tRect.left - 1);
    for (let i = 1; i < boxes.length; i++) {
      stops.push((boxes[i - 1].right + boxes[i].left) / 2 - tRect.left);
    }
    stops.push(boxes[boxes.length - 1].right - tRect.left + 1);
    stopsRef.current = stops;
    place(posRef.current);
  }, [place]);

  useEffect(() => {
    layout();
    const frame = frameRef.current;
    let ro: ResizeObserver | null = null;
    if (frame && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => layout());
      ro.observe(frame);
    } else {
      window.addEventListener('resize', layout);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', layout);
    };
  }, [layout]);

  return (
    <div className="demo demo-cut">
      <p className="demo-lead">{LEAD}</p>
      <p className="demo-hint">{HINT}</p>

      <div className="demo-cut-frame" ref={frameRef}>
        <div className="demo-cut-track" ref={trackRef}>
          {CUT_NODES.map((label, i) => (
            <Fragment key={label}>
              <span
                ref={(el) => {
                  nodeRefs.current[i] = el;
                }}
                className={
                  'demo-cut-node' +
                  (label === '?' ? ' demo-cut-node-q' : '') +
                  (isNear(i, pos) ? ' on' : '')
                }
                data-cut={label}
              >
                {label}
              </span>
              {i < CUT_NODES.length - 1 ? <span className="demo-cut-link" /> : null}
            </Fragment>
          ))}
          <div className="demo-cut-mark" style={{ left: markLeft ?? 0 }} />
        </div>
      </div>

      <FadeText className="demo-cut-caption demo-fade" text={captionOf(pos)} />

      {pos >= LAST ? (
        <div className="demo-final">
          <p className="demo-final-lead">Эксперимент не найдёт место разреза.</p>
          <p>
            {'Фон Нейман (1932): коллапс можно поместить в любое место цепи от прибора до «субъективного восприятия» — положение разреза задаёт не физика.'}
          </p>
        </div>
      ) : null}

      <div className="demo-row">
        <span className="demo-label">Разрез: {CUT_WORDS[pos]}</span>
        <input
          className="demo-slider"
          type="range"
          min={0}
          max={CUT_NODES.length} // 0..6 — семь положений разреза
          step={1}
          value={pos}
          aria-label="Положение разреза на цепи"
          onChange={(e) => place(Number(e.target.value) || 0)}
        />
      </div>

      <p className="demo-note">{NOTE}</p>
    </div>
  );
}
