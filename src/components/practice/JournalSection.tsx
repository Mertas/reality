/** Секция «Дневник»: промпт по времени суток, запись, список с удалением в два шага. */
import { useEffect, useState } from 'react';
import type { PracticeStoreApi } from '../../hooks/usePracticeStore';
import { dayKey, fmtTimeRu, hashStr, slotByHour } from '../../lib/dates';
import { Lines } from './Lines';
import { PROMPTS, SLOT_LABEL, trim, type PromptSlot } from './texts';

interface JournalSectionProps {
  store: PracticeStoreApi;
  /** Меняется при полном сбросе: чистим черновик, ротацию промпта и подтверждение удаления. */
  resetSignal: number;
  onStatus: (text: string) => void;
}

interface PromptView {
  text: string;
  index: number;
  total: number;
}

/* Промпт дня: детерминированная основа по дате и слоту + ручная ротация. */
function promptAt(slot: PromptSlot, shift: number): PromptView {
  const list = PROMPTS[slot] ?? PROMPTS.day;
  const total = list.length;
  if (!total) return { text: '', index: 0, total: 0 };
  const base = hashStr(`prompt|${dayKey()}|${slot}`) % total;
  const index = (((base + shift) % total) + total) % total;
  return { text: list[index], index, total };
}

export function JournalSection({ store, resetSignal, onStatus }: JournalSectionProps) {
  const { state, addEntry, removeEntry } = store;
  const [draft, setDraft] = useState('');
  const [shift, setShift] = useState(0);
  const [armed, setArmed] = useState<number | null>(null);

  useEffect(() => {
    setDraft('');
    setShift(0);
    setArmed(null);
  }, [resetSignal]);

  const slot = slotByHour();
  const prompt = promptAt(slot, shift);
  const journal = state.journal;
  const rows = journal.map((entry, index) => ({ entry, index })).reverse();

  const save = (): void => {
    const text = trim(draft);
    if (!text) {
      onStatus('Пустая запись не сохраняется — напиши хотя бы строку.');
      return;
    }
    addEntry(prompt.text, text);
    setDraft('');
    setShift((value) => value + 1);
    onStatus('Запись сохранена.');
  };

  const remove = (index: number): void => {
    removeEntry(index);
    setArmed(null);
    onStatus('Запись удалена.');
  };

  return (
    <div className="practice-sec">
      <h3 className="practice-h">Дневник</h3>

      <div className="practice-prompt">
        <div className="kicker">промпт · {SLOT_LABEL[slot] ?? slot}</div>
        <p className="practice-prompt-text">{prompt.text}</p>
        <div className="practice-prompt-actions">
          <button
            type="button"
            className="btn-ghost btn-s"
            onClick={() => setShift((value) => value + 1)}
          >
            другой промпт
          </button>
          <span className="hint">
            {prompt.index + 1} из {prompt.total}
          </span>
        </div>
      </div>

      <textarea
        className="practice-textarea"
        rows={5}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Пиши как есть. Записи остаются в этом браузере и никуда не отправляются."
      />
      <div className="practice-actions practice-journal-actions">
        <button type="button" className="btn" onClick={save}>
          Сохранить запись
        </button>
        <span className="hint">пустая запись не сохраняется</span>
      </div>

      {!journal.length ? (
        <p className="hint practice-empty">Пока пусто. Первая запись не обязана быть умной.</p>
      ) : (
        <>
          <ul className="practice-entries">
            {rows.map(({ entry, index }) => (
              <li className="practice-entry" key={`${entry.ts}-${index}`}>
                <div className="practice-entry-head">
                  <span className="practice-entry-date">{fmtTimeRu(entry.ts)}</span>
                  {entry.prompt ? (
                    <span className="practice-entry-prompt">{entry.prompt}</span>
                  ) : null}
                </div>
                <div className="practice-entry-text">
                  <Lines text={entry.text} />
                </div>
                <div className="practice-entry-actions">
                  {armed === index ? (
                    <>
                      <button
                        type="button"
                        className="practice-link"
                        onClick={() => remove(index)}
                      >
                        точно удалить
                      </button>
                      <button
                        type="button"
                        className="practice-link"
                        onClick={() => setArmed(null)}
                      >
                        отмена
                      </button>
                    </>
                  ) : (
                    <button type="button" className="practice-link" onClick={() => setArmed(index)}>
                      удалить
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="hint">записей: {journal.length}</p>
        </>
      )}
    </div>
  );
}
