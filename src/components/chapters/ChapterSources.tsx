/** Глава 6 — «Источники и честность»: таблица, честность, архив агентов. */
import { content } from '../../data/content';
import { Chapter } from './Chapter';
import { QuoteBadge } from '../ui/QuoteBlock';

export function ChapterSources() {
  const S = content.sources;

  return (
    <Chapter id="ch-sources" num="6" kicker="глава 6 · честность материала" title="Источники и честность">
      {S.intro ? <p className="lead">{S.intro}</p> : null}

      {S.table.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>что</th>
                <th>где</th>
                <th>статус</th>
              </tr>
            </thead>
            <tbody>
              {S.table.map((r, i) => (
                <tr key={i}>
                  <td>{r.what}</td>
                  <td>{r.where}</td>
                  <td>
                    <QuoteBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {S.honesty?.length ? (
        <>
          <h3>Честно</h3>
          <ul className="hint">
            {S.honesty.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      ) : null}

      {S.agents?.length ? (
        <>
          <h3>Архив отчётов агентов</h3>
          <ul className="hint">
            {S.agents.map((a) => (
              <li key={a.n}>
                <a href={a.file} target="_blank" rel="noopener noreferrer">
                  {a.n}. {a.title}
                </a>
                {a.note ? ` — ${a.note}` : ''}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="hint">
        версия {content.meta.version} · собрано {content.meta.built}
      </p>
    </Chapter>
  );
}
