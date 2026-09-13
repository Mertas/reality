/** Горизонтальная навигация по главам (мобильная). */
import { CHAPTERS, useApp } from '../../state/app';

export function MNav() {
  const { activeId, go } = useApp();

  return (
    <nav className="mnav" aria-label="Главы">
      {CHAPTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={activeId === c.id ? 'active' : ''}
          onClick={() => go(c.id)}
        >
          {c.label}
        </button>
      ))}
    </nav>
  );
}
