/** Обёртка главы: секция, номер-призрак, надзаголовок, заголовок, появление. */
import type { ReactNode } from 'react';
import { Reveal } from '../ui/Reveal';

interface ChapterProps {
  id: string;
  num?: string;
  kicker: string;
  title: string;
  /** Уровень заголовка: 1 — только для первой главы (на странице один h1). */
  level?: 1 | 2;
  children: ReactNode;
}

export function Chapter({ id, num, kicker, title, level = 2, children }: ChapterProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <section className="chapter" id={id}>
      {num && num !== '0' ? <div className="ch-num">{num}</div> : null}
      <p className="kicker">{kicker}</p>
      <Heading>{title}</Heading>
      <Reveal>{children}</Reveal>
    </section>
  );
}
