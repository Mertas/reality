/** Глава 3 — «Как берут невидимое»: четыре маршрута с демо. */
import { content } from '../../data/content';
import { Chapter } from './Chapter';
import { QuoteBlock } from '../ui/QuoteBlock';
import { DemoSlot } from '../demos/registry';

export function ChapterRoutes() {
  return (
    <Chapter id="ch-routes" num="3" kicker="глава 3 · четыре маршрута" title="Как невидимое всё-таки берут">
      {content.routes.map((r) => (
        <div className="route" key={r.id}>
          <h3>
            {r.n}. {r.title}
          </h3>
          {r.lead ? <p className="lead">{r.lead}</p> : null}
          {r.body.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          {r.demo ? <DemoSlot id={r.demo} hint={r.demoNote} /> : null}
          {r.quotes?.map((q, i) => (
            <QuoteBlock q={q} key={i} />
          ))}
        </div>
      ))}
    </Chapter>
  );
}
