/** «Вода дня»: строка по дате, кнопка копирования и подпись-подсказка. */
import { useEffect, useRef, useState } from 'react';

interface WaterOfDayProps {
  text: string;
  /** true — модуль данных пуст, строка дня единственная (запасная). */
  fallback: boolean;
}

/** Копирование с запасным путём для браузеров без navigator.clipboard. */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    area.remove();
    return !!ok;
  } catch {
    return false;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* упадём в запасной способ */
  }
  return legacyCopy(text);
}

export function WaterOfDay({ text, fallback }: WaterOfDayProps) {
  const [hint, setHint] = useState('');
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const onCopy = (): void => {
    void copyText(text).then((ok) => {
      if (!alive.current) return;
      setHint(ok ? 'скопировано' : 'не удалось скопировать — выдели строку вручную');
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (alive.current) setHint('');
      }, 4000);
    });
  };

  return (
    <div className="practice-water">
      <div className="kicker">вода дня</div>
      <p className="practice-water-line">{text}</p>
      <div className="practice-water-actions">
        <button type="button" className="btn-ghost btn-s" onClick={onCopy}>
          скопировать
        </button>
        <span className="hint">{hint}</span>
        {fallback ? (
          <span className="hint">модуль данных не загружен — строка дня пока единственная.</span>
        ) : null}
      </div>
    </div>
  );
}
