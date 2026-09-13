/** Глава 0 — «Вода»: вход, вопрос, как читать сайт. */
import { content } from '../../data/content';
import { useApp } from '../../state/app';
import { Chapter } from './Chapter';
import { QuoteBlock } from '../ui/QuoteBlock';

export function ChapterIntro() {
  const { go } = useApp();
  const d = content.intro;

  return (
    <Chapter id="ch-intro" kicker={d.kicker ?? 'reality · вода'} title={content.meta.title}>
      <p className="lead">{content.meta.subtitle}</p>
      {d.lead.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      {d.fish?.text ? <blockquote className="quote">{d.fish.text}</blockquote> : null}
      {d.wallace ? <QuoteBlock q={d.wallace} /> : null}
      {d.howto?.length ? (
        <ul className="hint">
          {d.howto.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn" onClick={() => go('ch-layers')}>
        начать: почему это почти теорема
      </button>
    </Chapter>
  );
}
