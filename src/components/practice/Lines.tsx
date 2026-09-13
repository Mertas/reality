/** Текст с переносами строк: переводы строк сохраняем (аналог nl2br в ванили). */
import { Fragment } from 'react';

export function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}
