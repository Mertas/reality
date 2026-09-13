/** Глава 1 — «Почти теорема»: пять слоёв невидимости с демо. */
import { content } from '../../data/content';
import { Chapter } from './Chapter';
import { QuoteBlock } from '../ui/QuoteBlock';
import { DemoSlot } from '../demos/registry';

export function ChapterLayers() {
  return (
    <Chapter id="ch-layers" num="1" kicker="глава 1 · пять слоёв" title="Почему это почти теорема">
      {content.layers.map((L) => (
        <div className="layer" key={L.id}>
          <h3>
            {L.n}. {L.title}
          </h3>
          {L.lead ? <p className="lead">{L.lead}</p> : null}
          {L.body.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          {L.demo ? <DemoSlot id={L.demo} hint={L.demoNote} /> : null}
          {L.quotes?.map((q, i) => (
            <QuoteBlock q={q} key={i} />
          ))}
          {L.terms?.map((t, i) => (
            <p className="hint" key={i}>
              <b>{t.term}</b> — {t.def}
            </p>
          ))}
        </div>
      ))}
    </Chapter>
  );
}
