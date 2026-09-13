/** Верхняя панель: логотип, прогресс, быстрый переход к практике. */
import { CHAPTERS, useApp } from '../../state/app';

export function TopBar() {
  const { visitedCount, go } = useApp();
  const percent = Math.round((100 * visitedCount) / CHAPTERS.length);

  return (
    <header className="topbar">
      <div className="logo">это&nbsp;вода</div>
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${percent}%` }} />
      </div>
      <button type="button" className="top-ghost" onClick={() => go('ch-practice')}>
        практика
      </button>
    </header>
  );
}
