/** Секция «Данные»: выгрузка .md/.json и полный сброс с двойным подтверждением. */
import { useEffect, useRef, useState } from 'react';
import type { PracticeDef } from '../../data/types';
import type { PracticeStoreApi } from '../../hooks/usePracticeStore';
import { dayKey } from '../../lib/dates';
import { buildMarkdown } from './stats';

interface DataSectionProps {
  store: PracticeStoreApi;
  practice: PracticeDef[];
  onStatus: (text: string) => void;
  /** Полный сброс (выполняет панель: стор + сброс секции дневника + сообщение). */
  onReset: () => void;
}

/** Скачивание через Blob. false — браузер не дал скачать, покажем текст вручную. */
function downloadText(filename: string, text: string, mime: string): boolean {
  try {
    if (!window.Blob || !window.URL || !window.URL.createObjectURL) return false;
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 0);
    return true;
  } catch {
    return false;
  }
}

export function DataSection({ store, practice, onStatus, onReset }: DataSectionProps) {
  const { state } = store;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (fallback === null) return;
    const area = fallbackRef.current;
    if (!area) return;
    try {
      area.focus();
      area.select();
    } catch {
      /* фокус — необязателен */
    }
  }, [fallback]);

  const exportMarkdown = (): void => {
    const emptyNote = state.journal.length
      ? ''
      : ' Записей пока нет — выгружены отметки и серия.';
    const markdown = buildMarkdown(state, practice);
    const name = `reality-journal-${dayKey()}.md`;
    if (downloadText(name, `\ufeff${markdown}`, 'text/markdown')) {
      setFallback(null);
      onStatus(`Файл ${name} сформирован — браузер сохранит его в загрузки.${emptyNote}`);
    } else {
      setFallback(markdown);
      onStatus('Скачивание напрямую недоступно — текст открыт ниже, скопируй его вручную.');
    }
  };

  const exportJson = (): void => {
    const json = JSON.stringify(state, null, 2);
    const name = `reality-practice-${dayKey()}.json`;
    if (downloadText(name, json, 'application/json')) {
      setFallback(null);
      onStatus(`Файл ${name} сформирован — браузер сохранит его в загрузки.`);
    } else {
      setFallback(json);
      onStatus('Скачивание напрямую недоступно — текст открыт ниже, скопируй его вручную.');
    }
  };

  return (
    <div className="practice-sec">
      <h3 className="practice-h">Данные</h3>
      <p className="hint">
        Всё хранится только в этом браузере. Экспорт — обычный файл: .md удобно читать, .json
        переносит состояние целиком.
      </p>
      <div className="practice-actions">
        <button type="button" className="btn-ghost" onClick={exportMarkdown}>
          Экспорт .md
        </button>
        <button type="button" className="btn-ghost" onClick={exportJson}>
          Экспорт .json
        </button>
      </div>

      {fallback !== null ? (
        <div className="practice-fallback">
          <p className="hint">
            Скачивание в этом браузере недоступно — текст ниже можно скопировать вручную.
          </p>
          <textarea
            ref={fallbackRef}
            className="practice-textarea"
            rows={8}
            readOnly
            value={fallback}
          />
        </div>
      ) : null}

      <div className="practice-danger">
        {!confirmOpen ? (
          <button type="button" className="practice-link" onClick={() => setConfirmOpen(true)}>
            Сбросить все данные
          </button>
        ) : (
          <>
            <p className="hint">
              Будут удалены все отметки, заметки и записи дневника. Вернуть их будет нельзя.
            </p>
            <div className="practice-actions">
              <button
                type="button"
                className="btn-ghost btn-s"
                onClick={() => {
                  setConfirmOpen(false);
                  setFallback(null);
                  onReset();
                }}
              >
                Удалить всё безвозвратно
              </button>
              <button type="button" className="btn-ghost btn-s" onClick={() => setConfirmOpen(false)}>
                отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
