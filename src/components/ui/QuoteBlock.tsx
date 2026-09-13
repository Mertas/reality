/** Цитата с пометкой достоверности. */
import type { Quote } from '../../data/types';

export function QuoteBadge({ status }: { status: string }) {
  const ok = /дослов/i.test(status);
  return <span className={`badge ${ok ? 'ok' : 'par'}`}>{ok ? 'дословно' : 'парафраз'}</span>;
}

export function QuoteBlock({ q }: { q: Quote }) {
  return (
    <blockquote className="quote">
      {q.text}
      <cite>
        {q.src} <QuoteBadge status={q.status} />
      </cite>
    </blockquote>
  );
}
