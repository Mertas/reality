/**
 * Панель практики — каркас. Полный перенос (вода дня, чек-лист, серии, дневник,
 * экспорт) выполняется из ванильной js/practice.js в следующих коммитах.
 */
import type { PracticeDef } from '../../data/types';

interface PracticePanelProps {
  practice: PracticeDef[];
  water: string[];
}

export function PracticePanel({ practice, water }: PracticePanelProps) {
  return (
    <div className="practice-host">
      <p className="hint">
        Модуль практики переносится на React: чек-лист, вода дня, серии и дневник появятся в
        ближайшем обновлении.
      </p>
      <p className="hint">
        Практик в списке: {practice.length}; строк «воды дня»: {water.length}.
      </p>
    </div>
  );
}
