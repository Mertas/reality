# PORT-CONTRACTS — перенос ванильных модулей в React

Проект `E:/My/Reality` переведён на **Vite + React + TypeScript** (канон стека: как в LLMPics — `@vitejs/plugin-react`, strict TS, npm).
Ванильная сборка (`js/*.js`, `css/*.css`, `index.html`) остаётся в репозитории как **источник переноса** (позже переедет в `legacy/`).

## 0. Общие правила React-порта (обязательны)

- Честный React: функциональные компоненты, хуки (`useRef`, `useState`, `useEffect`), никаких `window.*`-модулей, никаких прямых `document.getElementById`. Всё — через refs и состояние.
- **Cleanup обязателен**: на unmount снимать слушатели, отменять `requestAnimationFrame`, чистить таймеры (компонент может монтироваться/размонтироваться, в т.ч. дважды).
- Несколько **независимых экземпляров** компонента на странице должны работать одновременно (никаких модульных переменных-синглтонов).
- Язык интерфейса — русский, спокойный тон, без эмодзи. Тексты из ванильной версии сохранять.
- Стили — через токены из `src/styles/global.css` (см. список ниже); свои стили — в своём файле с префиксом (`demo-` / `practice-`).
- Никаких новых зависимостей, никаких внешних загрузок (offline).
- Перед сдачей: `cd E:/My/Reality && npm run typecheck` — без ошибок. Если доступен браузерный инструмент — проверить в браузере через `npm run dev -- --port 1838` (сервер :1837 уже занят другим прогоном).

**Токены (использовать, не переопределять):** `--bg #0a0f17`, `--bg-2 #0d1522`, `--panel #101b2b`, `--panel-2 #142134`, `--ink #e9e5da`, `--ink-dim #c2c8d4`, `--muted #8d99ad`, `--accent #e9c46a`, `--accent-soft`, `--water #7fb3d5`, `--water-soft`, `--line`, `--line-strong`, `--ok`, `--warn`, `--radius 14px`, `--radius-s 9px`, `--font-serif`, `--font-ui`.
Готовые классы: `.btn`, `.btn-ghost`, `.btn-s`, `.card`, `.panel`, `.chip`, `.quote`, `.kicker`, `.muted`, `.hint`, `.num`, `.hr`, `.grid-2`.

**Каркас, в который встраиваются модули (не менять):**
- `src/components/demos/registry.tsx` — реестр: `DEMO_META[id] = { title, Component }`; слот рисуется через `<DemoSlot id hint/>` (обёртка `DemoFrame` с заголовком и подсветкой).
- `src/components/chapters/*` — главы, читают контент из `src/data/content.ts` (`import { content } from '../../data/content'`).
- `src/state/app.tsx` — контекст: `useApp()` → `{ visited, activeId, go(id), openDemo(demoId), flashDemo }`.
- `src/lib/practiceStore.ts` — общий стор практики (уже написан, использовать как есть): типы `PracticeState/DayEntry/JournalEntry`, `loadPracticeState`, `savePracticeState`, `subscribePractice`, `toggleMark`, `setDayNote`, `addJournalEntry`, `resetPracticeState`, ключ `reality.practice.v1`, событие `reality:practice`.
- `src/lib/dates.ts` — `dayKey`, `computeStreak`, `totalDays`, `waterOfDay`, `fmtDateRu`, `fmtTimeRu`, `slotByHour`.

## 1. Задача D — демо (React-компоненты)

**Источник:** `js/demos.js` (финальная ванильная версия, ~1600 строк — прочитать целиком), `css/demos.css`, спецификации из `docs/CONTRACTS.md` §4.

**Цель:** заменить 7 заглушек в `src/components/demos/` реальными компонентами (имена экспортов сохранить!):

| Файл | Экспорт | Что это |
|---|---|---|
| `DemoTroxler.tsx` | `DemoTroxler` | Гаснущие пятна (Трокслер): canvas, фиксация взгляда, затухание при неподвижности, возврат при движении; слайдер времени 5–40 с |
| `DemoBlindspot.tsx` | `DemoBlindspot` | Слепое пятно: крест+точка, слайдер расстояния, инструкция для одного глаза |
| `DemoGorilla.tsx` | `DemoGorilla` | Горилла: счёт передач, проход гориллы, вопросы после раунда, результат с числами (46%, 88), повтор с подсказкой (0.6×) |
| `DemoNetiNeti.tsx` | `DemoNetiNeti` | Нети нети: чипсы-содержания, затухающие детали сцены, финальная панель, «вернуть всё» |
| `DemoLooking.tsx` | `DemoLooking` | Посмотри на то, что смотрит: 90 секунд, смена строк, досрочное завершение, заметка → дневник |
| `DemoContrast.tsx` | `DemoContrast` | Нет фона — нет фигуры: слайдер контраста 100→0% |
| `DemoCut.tsx` | `DemoCut` | Разрез фон Неймана: слайдер по цепи, меняющиеся подписи |

Требования к поведению — паритет с ванильной версией (та проверена агентами в браузере: гейтинг анимаций по видимости через IntersectionObserver, DPR-масштаб canvas, мобильная ширина, клавиатура/фокус). В React это делается идиоматично: `useEffect` + refs; IntersectionObserver — в хуке.

**Заметка «смотрящего»:** `DemoLooking` сохраняет заметку через `addJournalEntry(loadPracticeState(), prompt, text)` → `savePracticeState(...)` (из `src/lib/practiceStore.ts`). Если пусто — ничего не сохранять.

**Стили:** перенести из `css/demos.css` в `src/styles/demos.css` (адаптировать селекторы под те же классы; префикс `demo-`).

**Проверка:** `npm run typecheck`; в браузере (если доступен) — открыть `http://localhost:1838/react.html`, все 7 демо на местах, консоль чистая, второй экземпляр не конфликтует.

## 2. Задача E — практика (React-компоненты + хук)

**Источник:** `js/practice.js` (~1000 строк — прочитать целиком), `css/practice.css`, `docs/CONTRACTS.md` §5.

**Цель:**
- `src/hooks/usePracticeStore.ts` — React-обёртка над `src/lib/practiceStore.ts`: `useSyncExternalStore(subscribePractice, () => loadPracticeState())` + методы-обёртки (toggleMark/addEntry/setNote/reset), без дублирования логики.
- `src/components/practice/PracticePanel.tsx` — заменить заглушку, сохранив пропсы `{ practice: PracticeDef[]; water: string[] }` и класс-обёртку `practice-host`. Внутри — секции: «Сегодня», «Дневник», «Данные».
- «Сегодня»: дата (`fmtDateRu`), серия (`computeStreak`), всего дней (`totalDays`), «вода дня» (`waterOfDay`) + кнопка копирования; чек-лист практик (название, «зачем», сворачиваемое «как», чекбокс-отметка; `minutes` показывать); у практик с `demoId` — кнопка «Открыть демо» → `useApp().openDemo(demoId)`.
- «Дневник»: список записей (`fmtTimeRu`, промпт, текст), добавление (textarea + кнопка; пустое не сохранять), ротация промптов по времени суток (`slotByHour`: до 12 — утренние, 12–17 — дневные, после 17 — вечерние; ≥3 промпта на слот; тексты промптов — в компоненте).
- «Данные»: экспорт дневника в `.md` (шапка: серия, всего дней, статистика практик; затем записи) и `.json` (Blob-скачивание), сброс с двойным подтверждением (`resetPracticeState`).
- Пустые состояния — вежливые; всё в этом браузере; никаких сетевых запросов.

**Стили:** перенести из `css/practice.css` в `src/styles/practice.css`, префикс `practice-`, точки перелома 760/560px сохранить.

**Проверка:** `npm run typecheck`; в браузере (если доступен) — `http://localhost:1838/react.html`: отметки, дневник, экспорт, сброс, «Открыть демо» скроллит и подсвечивает слот.

## 3. Отчёт

Кратко: файлы; что проверено и как (реальные команды/скриншоты-состояния); отклонения от контракта; ограничения.
