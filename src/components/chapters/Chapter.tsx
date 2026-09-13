/** Обёртка главы: секция, номер-призрак, надзаголовок, заголовок, появление. */
import type { ReactNode } from 'react';
import { Reveal } from '../ui/Reveal';

interface ChapterProps {
  id: string;
  num?: string;
  kicker: string;
  title: string;
  children: ReactNode;
}

export function Chapter({ id, num, kicker, title, children }: ChapterProps) {
  return (
    <section className="chapter" id={id}>
      {num && num !== '0' ? <div className="ch-num">{num}</div> : null}
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      <Reveal>{children}</Reveal>
    </section>
  );
}
