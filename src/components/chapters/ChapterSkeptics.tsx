/** Глава 4 — «Где всё ломается»: скепсис и итог. */
import { content } from '../../data/content';
import { Chapter } from './Chapter';
import { QuoteBlock } from '../ui/QuoteBlock';

export function ChapterSkeptics() {
  const cl = content.closing;

  return (
    <Chapter id="ch-skeptics" num="4" kicker="глава 4 · скепсис" title="Где всё это ломается">
      {content.skeptics.map((s, i) => (
        <div className="card" key={s.id} style={{ marginBottom: 16 }}>
          <h4>
            {i + 1}. {s.title}
          </h4>
          <p>{s.body}</p>
          {s.verdict ? (
            <p className="hint">
              <b>что остаётся:</b> {s.verdict}
            </p>
          ) : null}
          {s.source ? <p className="hint">{s.source}</p> : null}
        </div>
      ))}

      {cl.paragraphs.length ? (
        <>
          <hr className="hr" />
          <h3>Итог</h3>
          {cl.paragraphs.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          {cl.wheeler ? <QuoteBlock q={cl.wheeler} /> : null}
        </>
      ) : null}
    </Chapter>
  );
}
