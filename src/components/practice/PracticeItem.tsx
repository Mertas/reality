/** Элемент чек-листа: отметка, название, «зачем», сворачиваемое «как», кнопка демо. */
import type { DemoId, PracticeDef } from '../../data/types';
import { Lines } from './Lines';
import { minutesLabel } from './texts';

interface PracticeItemProps {
  practice: PracticeDef;
  done: boolean;
  onMark: (on: boolean) => void;
  onDemo: (demoId: DemoId) => void;
}

export function PracticeItem({ practice, done, onMark, onDemo }: PracticeItemProps) {
  const minutes = minutesLabel(practice.minutes);
  const demoId = practice.demoId;

  return (
    <li className={done ? 'practice-item done' : 'practice-item'}>
      <div className="practice-item-head">
        <label className="practice-check-wrap">
          <input
            type="checkbox"
            className="practice-check"
            checked={done}
            onChange={(event) => onMark(event.target.checked)}
          />
          <span className="practice-title">{practice.title}</span>
        </label>
        {minutes ? <span className="chip practice-min">{minutes}</span> : null}
      </div>
      {practice.why ? <p className="practice-why">{practice.why}</p> : null}
      <div className="practice-item-foot">
        {demoId ? (
          <button
            type="button"
            className="btn-ghost btn-s practice-demo-btn"
            onClick={() => onDemo(demoId)}
          >
            Открыть демо
          </button>
        ) : null}
        {practice.how ? (
          /* open — неконтролируемый: раскрытие переживает перерисовки само */
          <details className="practice-how">
            <summary>как</summary>
            <div className="practice-how-body">
              <Lines text={practice.how} />
            </div>
          </details>
        ) : null}
      </div>
    </li>
  );
}
