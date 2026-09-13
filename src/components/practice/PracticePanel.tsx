/**
 * Панель практики — глава «Практика» (порт ванильной js/practice.js).
 * Секции: «Сегодня», «Дневник», «Данные»; всё хранится только в этом браузере.
 */
import { useCallback, useState } from 'react';
import type { DemoId, PracticeDef } from '../../data/types';
import { usePracticeStore } from '../../hooks/usePracticeStore';
import { useApp } from '../../state/app';
import { TodaySection } from './TodaySection';
import { JournalSection } from './JournalSection';
import { DataSection } from './DataSection';

interface PracticePanelProps {
  practice: PracticeDef[];
  water: string[];
}

export function PracticePanel({ practice, water }: PracticePanelProps) {
  const store = usePracticeStore();
  const { storageOk, reset } = store;
  const { openDemo } = useApp();

  /* Строка состояния — одна на модуль; сообщение задаёт то действие, которое случилось. */
  const [status, setStatus] = useState('');
  /* Счётчик полных сбросов: секция дневника по нему чистит черновик и ротацию промпта. */
  const [resetSignal, setResetSignal] = useState(0);

  const handleOpenDemo = useCallback(
    (demoId: DemoId) => {
      setStatus('');
      openDemo(demoId);
    },
    [openDemo],
  );

  const handleReset = useCallback(() => {
    reset();
    setResetSignal((value) => value + 1);
    setStatus('Данные удалены. Серия начнётся заново с сегодняшнего дня.');
  }, [reset]);

  return (
    <div className="practice-host">
      <div className="practice">
        {!storageOk ? (
          <p className="practice-note">
            Локальное хранилище недоступно: браузер не разрешает сохранять данные. Отметки и записи
            будут жить до перезагрузки страницы.
          </p>
        ) : null}

        <TodaySection
          practice={practice}
          water={water}
          store={store}
          onOpenDemo={handleOpenDemo}
        />
        <JournalSection store={store} resetSignal={resetSignal} onStatus={setStatus} />
        <DataSection
          store={store}
          practice={practice}
          onStatus={setStatus}
          onReset={handleReset}
        />

        <p className="hint practice-status">{status}</p>
      </div>
    </div>
  );
}
