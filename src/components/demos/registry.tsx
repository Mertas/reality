/** Реестр демо: id → (заголовок, React-компонент). */
import type { ComponentType } from 'react';
import type { DemoId } from '../../data/types';
import { DemoFrame } from './DemoFrame';
import { DemoTroxler } from './DemoTroxler';
import { DemoBlindspot } from './DemoBlindspot';
import { DemoGorilla } from './DemoGorilla';
import { DemoNetiNeti } from './DemoNetiNeti';
import { DemoLooking } from './DemoLooking';
import { DemoContrast } from './DemoContrast';
import { DemoCut } from './DemoCut';

export const DEMO_META: Record<DemoId, { title: string; Component: ComponentType }> = {
  troxler: { title: 'Гаснущие пятна', Component: DemoTroxler },
  blindspot: { title: 'Слепое пятно', Component: DemoBlindspot },
  gorilla: { title: 'Горилла', Component: DemoGorilla },
  netineti: { title: 'Нети нети', Component: DemoNetiNeti },
  looking: { title: 'Посмотри на то, что смотрит', Component: DemoLooking },
  contrast: { title: 'Нет фона — нет фигуры', Component: DemoContrast },
  cut: { title: 'Разрез фон Неймана', Component: DemoCut },
};

export function DemoSlot({ id, hint }: { id: DemoId; hint?: string }) {
  const { title, Component } = DEMO_META[id];
  return (
    <DemoFrame id={id} title={title} hint={hint}>
      <Component />
    </DemoFrame>
  );
}
