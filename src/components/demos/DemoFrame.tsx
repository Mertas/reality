/** Рамка демо: заголовок, подпись и подсветка при открытии из практики. */
import type { ReactNode } from 'react';
import { useApp } from '../../state/app';

interface DemoFrameProps {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}

export function DemoFrame({ id, title, hint, children }: DemoFrameProps) {
  const { flashDemo } = useApp();
  return (
    <div id={`demo-${id}`} className={flashDemo === id ? 'demo-slot flash' : 'demo-slot'}>
      <div className="demo-head">
        <p className="kicker">демо</p>
        <p className="demo-title">{title}</p>
        {hint ? <p className="hint">{hint}</p> : null}
      </div>
      <div className="demo-body">{children}</div>
    </div>
  );
}
