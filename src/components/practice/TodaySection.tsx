/** Секция «Сегодня»: дата, серия, вода дня, чек-лист практик, заметка о дне. */
import type { DemoId, PracticeDef } from '../../data/types';
import { computeStreak, dayKey, fmtDateRu, waterOfDay } from '../../lib/dates';
import type { PracticeStoreApi } from '../../hooks/usePracticeStore';
import { PracticeItem } from './PracticeItem';
import { WaterOfDay } from './WaterOfDay';
import { DEFAULT_WATER, plural, trim } from './texts';
import { daysWithMarks, marksTotal, startLabel } from './stats';

interface TodaySectionProps {
  practice: PracticeDef[];
  water: string[];
  store: PracticeStoreApi;
  onOpenDemo: (demoId: DemoId) => void;
}

export function TodaySection({ practice, water, store, onOpenDemo }: TodaySectionProps) {
  const { state, toggleMark, setNote } = store;

  const today = new Date();
  const todayKey = dayKey(today);
  const day = state.days[todayKey];
  const marks = day?.marks ?? [];

  const streak = computeStreak(state.days);
  const start = startLabel(state);
  const statsLine =
    `дней с практикой: ${daysWithMarks(state)} · отметок: ${marksTotal(state)}` +
    (start ? ` · начало: ${start}` : '');

  const lines = water.map((line) => trim(line)).filter((line) => line.length > 0);
  const fallback = lines.length === 0;
  const waterLine = waterOfDay(fallback ? [DEFAULT_WATER] : lines, today);

  return (
    <div className="practice-sec practice-sec-today">
      <p className="kicker">практика · сегодня</p>
      <h3 className="practice-h">Сегодня</h3>
      <div className="practice-today">
        <div className="practice-date">{fmtDateRu(today)}</div>
        <div className="practice-streak">
          серия: <span className="num">{streak}</span> {plural(streak, ['день', 'дня', 'дней'])}{' '}
          подряд
        </div>
        <div className="practice-stats hint">{statsLine}</div>
      </div>

      <WaterOfDay text={waterLine} fallback={fallback} />

      {practice.length ? (
        <>
          <h4 className="practice-sub">Практики дня</h4>
          <p className="hint">
            Отмечай только сделанное: серия считает дни с отметками, а не открытые страницы.
          </p>
          <ul className="practice-list">
            {practice.map((item) => (
              <PracticeItem
                key={item.id}
                practice={item}
                done={marks.includes(item.id)}
                onMark={(on) => toggleMark(item.id, on)}
                onDemo={onOpenDemo}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="hint practice-empty">
          Список практик придёт из модуля данных, а он сейчас не загружен. Серия дней, дневник и
          экспорт работают и без него.
        </p>
      )}

      <label className="practice-notewrap">
        <span className="practice-note-label">
          заметка о дне <span className="muted">— необязательно, одна строка</span>
        </span>
        <input
          type="text"
          className="practice-input"
          maxLength={240}
          value={day?.note ?? ''}
          onChange={(event) => setNote(event.target.value)}
          placeholder="что заметил сегодня"
        />
      </label>
    </div>
  );
}
