/** Глава 5 — «Практика»: жизнеобразующее ядро (вода дня, чек-лист, дневник). */
import { content } from '../../data/content';
import { Chapter } from './Chapter';
import { PracticePanel } from '../practice/PracticePanel';

export function ChapterPractice() {
  return (
    <Chapter
      id="ch-practice"
      num="5"
      kicker="глава 5 · держать воду в поле внимания"
      title="Практика"
    >
      <p className="lead">
        Это ядро сайта: упражнения, вода дня, серии и дневник. Всё — только в этом браузере.
      </p>
      <PracticePanel practice={content.practice} water={content.water} />
    </Chapter>
  );
}
