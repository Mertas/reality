/** Глава 2 — «Жильцы ниши»: карточки кандидатов. */
import { content } from '../../data/content';
import { Chapter } from './Chapter';

export function ChapterCandidates() {
  return (
    <Chapter id="ch-candidates" num="2" kicker="глава 2 · ниша и её жильцы" title="Ниша и её жильцы">
      <p className="lead">
        Ниша гарантирована конститутивно — а вот на то, кто в ней живёт, претендуют несовместимые
        кандидаты.
      </p>
      <div className="cards">
        {content.candidates.map((c) => (
          <div className="card" key={c.id}>
            <h4>{c.name}</h4>
            {c.subtitle ? <p className="sub">{c.subtitle}</p> : null}
            <p>{c.claim}</p>
            <p className="hint">почему подходит: {c.why}</p>
            <p className="hint">ахиллесова пята: {c.caveat}</p>
            <div className="tags">
              <span className="chip">{c.tag ?? 'претендент'}</span>
            </div>
          </div>
        ))}
      </div>
    </Chapter>
  );
}
