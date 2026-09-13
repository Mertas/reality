/** Боковая навигация по главам (desktop). */
import { CHAPTERS, useApp } from '../../state/app';

export function RailNav() {
  const { visited, activeId, go } = useApp();

  return (
    <aside className="rail">
      <nav aria-label="Главы">
        {CHAPTERS.map((c) => {
          const cls = [activeId === c.id ? 'active' : '', visited[c.id] ? 'done' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button key={c.id} type="button" className={cls} onClick={() => go(c.id)}>
              <span className="n">{c.n}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="rail-foot">прогресс и дневник хранятся в этом браузере.</div>
    </aside>
  );
}
