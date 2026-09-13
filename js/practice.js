/* ==========================================================================
   «Это вода» — глава «Практика» (контракт: docs/CONTRACTS.md §5)
   Серия дней, «вода дня», чек-лист практик, дневник, экспорт и сброс.
   Состояние: localStorage, ключ `reality.practice.v1`.
   Классический скрипт, без зависимостей; работает и по file://.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'reality.practice.v1';
  var BACKUP_KEY = 'reality.practice.v1.backup';
  var VERSION = 1;

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда',
                  'четверг', 'пятница', 'суббота'];

  /* Промпты дневника: три слота по времени суток, по пять в каждом. */
  var PROMPTS = {
    morning: [
      'Что сегодня может оказаться водой — фоном, который не видно, пока он не сломается?',
      'Какое условие делает возможным именно этот день? Попробуй назвать его, не перечисляя предметы.',
      'Что ты принимаешь как само собой разумеющееся настолько, что об этом нечего сказать?',
      'Если отнять у утра всё переменное — что останется неизменным?',
      'Что сегодня будет для тебя очевидным — и потому, скорее всего, незамеченным?'
    ],
    day: [
      'Что сейчас в кадре, а что осталось за кадром — и кто провёл эту границу?',
      'Какое различие ты проводишь прямо сейчас — и что оно оставляет в стороне?',
      'Чем ты пользуешься в эту минуту без усилия и без внимания?',
      'Если убрать из момента всё, что могло быть иным, — что не убирается?',
      'С чем можно сверить этот момент, чтобы увидеть его второй моделью?'
    ],
    evening: [
      'Что сегодня было очевидным — а ты не увидел?',
      'Что сегодня стало заметным только на контрасте — и без него не существовало бы?',
      'Что сегодня работало, но не попало ни в одну твою формулировку?',
      'Что открылось не рассматриванием, а нарушением — сменой среды, поломкой, паузой?',
      'Что из сегодняшнего осталось бы незамеченным без второго взгляда?'
    ]
  };

  var SLOT_LABEL = { morning: 'утро', day: 'день', evening: 'вечер' };
  var DEFAULT_WATER = 'Это вода.';

  /* ==================== состояние модуля ==================== */

  var state = null;        // структура из контракта
  var data = {};           // REALITY_DATA (может быть пустым)
  var rootEl = null;       // контейнер рендера
  var storageOk = true;    // удалось ли дотянуться до localStorage
  var storageWarned = false;
  var lsCache = null;
  var draft = '';          // черновик textarea (переживает перерисовку)
  var openHow = {};        // какие блоки «как» раскрыты
  var promptShift = 0;     // ручная ротация промпта
  var armedEntry = -1;     // индекс записи, ждущей подтверждения удаления
  var resetOpen = false;   // раскрыт ли блок сброса

  /* ==================== мелкие утилиты ==================== */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  /* Устойчивый хеш строки → 32 бита без знака (для детерминированного выбора). */
  function hash32(str) {
    var h = 5381, i;
    str = String(str);
    for (i = 0; i < str.length; i++) {
      h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  /* Русские формы: plural(2, ['день','дня','дней']) → 'дня' */
  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  /* Локальная дата, без UTC: время суток и «сегодня» должны совпадать с твоими. */
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function humanDate(key) {
    var p = String(key || '').split('-');
    var d = new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
    if (isNaN(d.getTime())) return String(key || '');
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + WEEKDAYS[d.getDay()];
  }

  function humanTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() +
           ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function slotNow() {
    var h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'day';
    return 'evening';
  }

  function minutesLabel(m) {
    if (m == null || m === '') return '';
    if (typeof m === 'number' && isFinite(m)) return m + ' мин';
    return String(m);
  }

  /* ==================== хранилище ==================== */

  function getLS() {
    if (lsCache) return lsCache;
    try {
      var ls = window.localStorage;
      if (!ls) return null;
      var probe = '__reality_practice_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      lsCache = ls;
      return ls;
    } catch (e) {
      return null; /* приватный режим, запрет хранилища, старый браузер */
    }
  }

  function normState(raw) {
    var s = { v: VERSION, start: new Date().toISOString(), days: {}, journal: [] };
    var i, k, d, e, marks;
    if (!raw || typeof raw !== 'object') return s;

    if (typeof raw.start === 'string' && raw.start) s.start = raw.start;

    if (raw.days && typeof raw.days === 'object' && !isArr(raw.days)) {
      for (k in raw.days) {
        if (!has(raw.days, k)) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        d = raw.days[k];
        if (!d || typeof d !== 'object') continue;
        marks = [];
        if (isArr(d.marks)) {
          for (i = 0; i < d.marks.length; i++) {
            if (typeof d.marks[i] === 'string' && d.marks[i]) marks.push(d.marks[i]);
          }
        }
        s.days[k] = {
          marks: marks,
          note: typeof d.note === 'string' ? d.note : ''
        };
      }
    }

    if (isArr(raw.journal)) {
      for (i = 0; i < raw.journal.length; i++) {
        e = raw.journal[i];
        if (!e || typeof e !== 'object') continue;
        if (typeof e.text !== 'string' || !trim(e.text)) continue;
        s.journal.push({
          ts: typeof e.ts === 'string' && e.ts ? e.ts : new Date().toISOString(),
          prompt: typeof e.prompt === 'string' ? e.prompt : '',
          text: e.text
        });
      }
    }

    return s;
  }

  function load() {
    var ls = getLS();
    if (!ls) {
      storageOk = false;
      state = normState(null);
      return;
    }
    var raw = null;
    try { raw = ls.getItem(STORAGE_KEY); } catch (e) { raw = null; }

    var parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      if (parsed === null) {
        /* данные повреждены: не выбрасываем молча — оставляем копию */
        try { ls.setItem(BACKUP_KEY, raw); } catch (e2) { /* уже нечем помочь */ }
      }
    }
    state = normState(parsed);
    storageOk = true;
  }

  function save() {
    var ls = getLS();
    if (!ls) { storageOk = false; warnStorage(); return false; }
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
      return true;
    } catch (e) {
      storageOk = false;
      warnStorage();
      return false;
    }
  }

  function warnStorage() {
    if (storageWarned) return;
    storageWarned = true;
    setStatus('Сохранить не удалось: локальное хранилище недоступно. Данные останутся до перезагрузки страницы.');
  }

  /* ==================== дни и статистика ==================== */

  function dayGet(key, create) {
    var d = state.days[key];
    if (!d) {
      if (!create) return null;
      d = { marks: [], note: '' };
      state.days[key] = d;
    }
    if (!isArr(d.marks)) d.marks = [];
    if (typeof d.note !== 'string') d.note = '';
    return d;
  }

  /* Пустой день в состоянии не держим: числа должны быть честными. */
  function dayCleanup(key) {
    var d = state.days[key];
    if (d && (!d.marks || !d.marks.length) && !trim(d.note)) delete state.days[key];
  }

  function dayKeys() {
    var out = [], k;
    for (k in state.days) { if (has(state.days, k)) out.push(k); }
    out.sort();
    return out;
  }

  function markedOn(key) {
    var d = state.days[key];
    return !!(d && d.marks && d.marks.length);
  }

  function daysWithMarks() {
    var ks = dayKeys(), n = 0, i;
    for (i = 0; i < ks.length; i++) { if (markedOn(ks[i])) n++; }
    return n;
  }

  function marksTotal() {
    var ks = dayKeys(), n = 0, i, d;
    for (i = 0; i < ks.length; i++) {
      d = state.days[ks[i]];
      if (d && d.marks) n += d.marks.length;
    }
    return n;
  }

  /* Серия: подряд идущие дни с отметками. Незакрытый сегодняшний день серию не рвёт. */
  function streakCount() {
    var d = new Date(), n = 0, guard = 0;
    if (!markedOn(dateKey(d))) d.setDate(d.getDate() - 1);
    while (guard++ < 5000) {
      if (!markedOn(dateKey(d))) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function practiceStats() {
    var counts = {}, ks = dayKeys(), i, j, d, marks, list, titles = {}, id, out = [];
    for (i = 0; i < ks.length; i++) {
      d = state.days[ks[i]];
      if (!d || !d.marks) continue;
      marks = d.marks;
      for (j = 0; j < marks.length; j++) {
        counts[marks[j]] = (counts[marks[j]] || 0) + 1;
      }
    }
    list = listPractices();
    for (i = 0; i < list.length; i++) titles[list[i].id] = list[i].title;
    for (id in counts) {
      if (!has(counts, id)) continue;
      out.push({ id: id, title: titles[id] || id, count: counts[id] });
    }
    out.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
    });
    return out;
  }

  /* ==================== контент из data ==================== */

  function waterLines() {
    var w = data ? data.water : null, out = [], i;
    if (isArr(w)) {
      for (i = 0; i < w.length; i++) {
        if (typeof w[i] === 'string' && trim(w[i])) out.push(trim(w[i]));
      }
    }
    if (out.length) return { list: out, fallback: false };
    return { list: [DEFAULT_WATER], fallback: true };
  }

  function waterOfDay(key) {
    var w = waterLines();
    return {
      text: w.list[hash32('water|' + key) % w.list.length],
      fallback: w.fallback
    };
  }

  function listPractices() {
    var p = data ? data.practice : null, out = [], i, it, id;
    if (!isArr(p)) return out;
    for (i = 0; i < p.length; i++) {
      it = p[i];
      if (!it || typeof it !== 'object') continue;
      id = it.id ? String(it.id) : ('p' + i);
      out.push({
        id: id,
        title: it.title ? String(it.title) : id,
        why: it.why ? String(it.why) : '',
        how: it.how ? String(it.how) : '',
        minutes: it.minutes,
        demoId: it.demoId ? String(it.demoId) : ''
      });
    }
    return out;
  }

  function currentPrompt() {
    var slot = slotNow();
    var list = isArr(PROMPTS[slot]) ? PROMPTS[slot] : PROMPTS.day;
    var base = hash32('prompt|' + dateKey() + '|' + slot) % list.length;
    var idx = ((base + promptShift) % list.length + list.length) % list.length;
    return { slot: slot, text: list[idx], index: idx, total: list.length };
  }

  /* ==================== действия над состоянием ==================== */

  function setMark(id, on) {
    if (!id) return;
    var key = dateKey();
    var d = dayGet(key, true);
    var i = d.marks.indexOf(id);
    if (on && i === -1) d.marks.push(id);
    if (!on && i !== -1) d.marks.splice(i, 1);
    dayCleanup(key);
    save();
  }

  function setNote(value) {
    var key = dateKey();
    var d = dayGet(key, true);
    d.note = String(value == null ? '' : value);
    dayCleanup(key);
    save();
  }

  function addEntry(prompt, text) {
    var t = trim(text);
    if (!t) return null;
    var entry = {
      ts: new Date().toISOString(),
      prompt: prompt ? String(prompt) : currentPrompt().text,
      text: t
    };
    state.journal.push(entry);
    save();
    return entry;
  }

  function deleteEntry(i) {
    if (typeof i !== 'number' || isNaN(i) || i < 0 || i >= state.journal.length) {
      armedEntry = -1;
      render();
      return;
    }
    state.journal.splice(i, 1);
    armedEntry = -1;
    save();
    render();
    setStatus('Запись удалена.');
  }

  function resetAll() {
    state = normState(null);
    resetOpen = false;
    armedEntry = -1;
    draft = '';
    promptShift = 0;
    save();
    render();
    setStatus('Данные удалены. Серия начнётся заново с сегодняшнего дня.');
  }

  /* ==================== экспорт ==================== */

  function buildMarkdown() {
    var L = [], st = state, j = st.journal || [], i, e, stats, notes, ks, d;
    var startKeyLocal = startKey();

    L.push('# Дневник практики — «Это вода»');
    L.push('');
    L.push('- Серия дней подряд: ' + streakCount());
    L.push('- Всего дней с отметками: ' + daysWithMarks());
    L.push('- Отметок всего: ' + marksTotal());
    L.push('- Начало практики: ' + (startKeyLocal ? humanDate(startKeyLocal) : '—'));
    L.push('- Выгружено: ' + humanTime(new Date().toISOString()));

    stats = practiceStats();
    L.push('');
    L.push('## Практики');
    L.push('');
    if (stats.length) {
      for (i = 0; i < stats.length; i++) {
        L.push('- ' + stats[i].title + ' — ' + stats[i].count + ' ' +
               plural(stats[i].count, ['отметка', 'отметки', 'отметок']));
      }
    } else {
      L.push('Отметок практик пока нет.');
    }

    L.push('');
    L.push('## Записи дневника');
    L.push('');
    if (!j.length) {
      L.push('Записей пока нет.');
    } else {
      for (i = 0; i < j.length; i++) {
        e = j[i];
        L.push('### ' + humanTime(e.ts));
        if (e.prompt) {
          L.push('');
          L.push('*' + e.prompt + '*');
        }
        L.push('');
        L.push(e.text);
        L.push('');
      }
    }

    ks = dayKeys();
    notes = [];
    for (i = 0; i < ks.length; i++) {
      d = state.days[ks[i]];
      if (d && trim(d.note)) notes.push('- ' + humanDate(ks[i]) + ' — ' + trim(d.note));
    }
    if (notes.length) {
      L.push('## Заметки о днях');
      L.push('');
      for (i = 0; i < notes.length; i++) L.push(notes[i]);
      L.push('');
    }

    return L.join('\n');
  }

  /* Скачивание через Blob. Возвращает false, если браузер не дал скачать. */
  function download(filename, text, mime) {
    try {
      if (!window.Blob || !window.URL || !window.URL.createObjectURL) return false;
      var blob = new Blob([text], { type: mime + ';charset=utf-8' });
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      window.setTimeout(function () {
        try { document.body.removeChild(a); } catch (e) { /* уже нет */ }
        try { window.URL.revokeObjectURL(url); } catch (e2) { /* уже не нужен */ }
      }, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  function showFallback(bodyText) {
    if (!rootEl) return;
    var wrap = rootEl.querySelector('[data-role="fallback"]');
    var area = rootEl.querySelector('[data-role="fallback-text"]');
    if (!wrap || !area) return;
    area.value = bodyText;
    wrap.hidden = false;
    try { area.focus(); area.select(); } catch (e) { /* необязательно */ }
  }

  function hideFallback() {
    if (!rootEl) return;
    var wrap = rootEl.querySelector('[data-role="fallback"]');
    if (wrap) wrap.hidden = true;
  }

  function doExport(kind) {
    if (!rootEl) return;
    var key = dateKey();
    var emptyNote = ((state.journal || []).length ? '' : ' Записей пока нет — выгружены отметки и серия.');
    if (kind === 'md') {
      var md = buildMarkdown();
      var name = 'reality-journal-' + key + '.md';
      if (download(name, '\ufeff' + md, 'text/markdown')) {
        hideFallback();
        setStatus('Файл ' + name + ' сформирован — браузер сохранит его в загрузки.' + emptyNote);
      } else {
        showFallback(md);
        setStatus('Скачивание напрямую недоступно — текст открыт ниже, скопируй его вручную.');
      }
    } else {
      var json = JSON.stringify(state, null, 2);
      var jname = 'reality-practice-' + key + '.json';
      if (download(jname, json, 'application/json')) {
        hideFallback();
        setStatus('Файл ' + jname + ' сформирован — браузер сохранит его в загрузки.');
      } else {
        showFallback(json);
        setStatus('Скачивание напрямую недоступно — текст открыт ниже, скопируй его вручную.');
      }
    }
  }

  /* ==================== соседи: демо и дневник ==================== */

  function openDemo(demoId) {
    if (!demoId) return 'none';

    if (window.App && typeof window.App.openDemo === 'function') {
      try {
        var res = window.App.openDemo(demoId);
        if (res !== false) {
          setStatus('');
          return 'app';
        }
      } catch (e) { /* падать из-за соседа не будем */ }
    }

    var slot = null;
    try {
      slot = document.querySelector('.demo-slot[data-demo-id="' + demoId + '"]') ||
             document.querySelector('[data-demo-id="' + demoId + '"]');
    } catch (e) { slot = null; }

    if (slot) {
      /* app.js не загрузился — смонтируем демо сами, если модуль демо на месте */
      setStatus('');
      var demos = window.Demos;
      var body = slot.querySelector('.demo-body') || slot;
      if (!slot.getAttribute('data-practice-mounted') &&
          demos && typeof demos.has === 'function' && demos.has(demoId) &&
          typeof demos.mount === 'function') {
        try {
          demos.mount(demoId, body);
          slot.setAttribute('data-practice-mounted', '1');
        } catch (e2) { /* демо не обязано смонтироваться */ }
      }
      try {
        if (slot.scrollIntoView) slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e3) {
        try { slot.scrollIntoView(); } catch (e4) { /* необязательно */ }
      }
      slot.className += ' flash';
      window.setTimeout(function () {
        slot.className = slot.className.replace(/(^|\s)flash(?=\s|$)/, ' ');
      }, 1800);
      return 'slot';
    }

    setStatus('Демо «' + demoId + '» на этой странице не смонтировано.');
    return 'none';
  }

  function copyText(text, done) {
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
        return;
      }
    } catch (e) { /* упадём в запасной способ */ }
    ok = legacyCopy(text);
    done(ok);
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand ? document.execCommand('copy') : false;
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  /* ==================== рендер ==================== */

  function setStatus(text) {
    if (!rootEl) return;
    var el = rootEl.querySelector('[data-role="status"]');
    if (el) el.textContent = text || '';
  }

  function statsLine() {
    var s = 'дней с практикой: ' + daysWithMarks() + ' · отметок: ' + marksTotal();
    var st = startKey();
    if (st) s += ' · начало: ' + humanDate(st);
    return s;
  }

  /* Начало практики — в местной дате, а не в UTC-части ISO-строки. */
  function startKey() {
    if (!state.start) return '';
    var d = new Date(state.start);
    if (isNaN(d.getTime())) {
      var s = String(state.start).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
    }
    return dateKey(d);
  }

  /* Сохраняем то, что живёт в DOM и не должно теряться при перерисовке. */
  function captureUi() {
    if (!rootEl) return;
    var ta = rootEl.querySelector('.practice-js-entry');
    if (ta) draft = ta.value;
    var ds = rootEl.querySelectorAll('details.practice-how');
    for (var i = 0; i < ds.length; i++) {
      var id = ds[i].getAttribute('data-id');
      if (!id) continue;
      if (ds[i].open) openHow[id] = true; else delete openHow[id];
    }
  }

  function todayHtml(key, day, marks) {
    var h = [], i, p, done;
    var streak = streakCount();
    var water = waterOfDay(key);
    var list = listPractices();

    h.push('<div class="practice-sec practice-sec-today">');
    h.push('<p class="kicker">практика · сегодня</p>');
    h.push('<h3 class="practice-h">Сегодня</h3>');
    h.push('<div class="practice-today">');
    h.push('<div class="practice-date">' + esc(humanDate(key)) + '</div>');
    h.push('<div class="practice-streak" data-role="streak-line">' + streakLine(streak) + '</div>');
    h.push('<div class="practice-stats hint" data-role="stats">' + esc(statsLine()) + '</div>');
    h.push('</div>');

    /* вода дня */
    h.push('<div class="practice-water">');
    h.push('<div class="kicker">вода дня</div>');
    h.push('<p class="practice-water-line">' + esc(water.text) + '</p>');
    h.push('<div class="practice-water-actions">');
    h.push('<button type="button" class="btn-ghost btn-s" data-act="copy-water">скопировать</button>');
    h.push('<span class="hint" data-role="copy"></span>');
    if (water.fallback) {
      h.push('<span class="hint">модуль данных не загружен — строка дня пока единственная.</span>');
    }
    h.push('</div></div>');

    /* чек-лист практик */
    if (list.length) {
      h.push('<h4 class="practice-sub">Практики дня</h4>');
      h.push('<p class="hint">Отмечай только сделанное: серия считает дни с отметками, а не открытые страницы.</p>');
      h.push('<ul class="practice-list">');
      for (i = 0; i < list.length; i++) {
        p = list[i];
        done = marks.indexOf(p.id) !== -1;
        h.push('<li class="practice-item' + (done ? ' done' : '') + '" data-id="' + esc(p.id) + '">');
        h.push('<div class="practice-item-head">');
        h.push('<label class="practice-check-wrap">');
        h.push('<input type="checkbox" class="practice-check" data-act="mark" data-id="' + esc(p.id) + '"' + (done ? ' checked' : '') + '>');
        h.push('<span class="practice-title">' + esc(p.title) + '</span>');
        h.push('</label>');
        if (minutesLabel(p.minutes)) h.push('<span class="chip practice-min">' + esc(minutesLabel(p.minutes)) + '</span>');
        h.push('</div>');
        if (p.why) h.push('<p class="practice-why">' + esc(p.why) + '</p>');
        h.push('<div class="practice-item-foot">');
        if (p.demoId) {
          h.push('<button type="button" class="btn-ghost btn-s practice-demo-btn" data-act="demo" data-demo="' + esc(p.demoId) + '">Открыть демо</button>');
        }
        if (p.how) {
          h.push('<details class="practice-how" data-id="' + esc(p.id) + '"' + (openHow[p.id] ? ' open' : '') + '>');
          h.push('<summary>как</summary>');
          h.push('<div class="practice-how-body">' + nl2br(p.how) + '</div>');
          h.push('</details>');
        }
        h.push('</div></li>');
      }
      h.push('</ul>');
    } else {
      h.push('<p class="hint practice-empty">Список практик придёт из модуля данных, а он сейчас не загружен. ' +
             'Серия дней, дневник и экспорт работают и без него.</p>');
    }

    /* заметка о дне — поле из контракта (days[date].note) */
    h.push('<label class="practice-notewrap">');
    h.push('<span class="practice-note-label">заметка о дне <span class="muted">— необязательно, одна строка</span></span>');
    h.push('<input type="text" class="practice-input" data-act="note" maxlength="240" value="' + esc(day.note || '') + '" placeholder="что заметил сегодня">');
    h.push('</label>');

    h.push('</div>');
    return h.join('');
  }

  function streakLine(n) {
    return 'серия: <span class="num" data-role="streak">' + n + '</span> ' +
           plural(n, ['день', 'дня', 'дней']) + ' подряд';
  }

  function journalHtml() {
    var h = [], i, e, j = state.journal || [];
    var p = currentPrompt();

    h.push('<div class="practice-sec">');
    h.push('<h3 class="practice-h">Дневник</h3>');
    h.push('<div class="practice-prompt">');
    h.push('<div class="kicker">промпт · ' + esc(SLOT_LABEL[p.slot] || p.slot) + '</div>');
    h.push('<p class="practice-prompt-text" data-role="prompt">' + esc(p.text) + '</p>');
    h.push('<div class="practice-prompt-actions">');
    h.push('<button type="button" class="btn-ghost btn-s" data-act="next-prompt">другой промпт</button>');
    h.push('<span class="hint">' + (p.index + 1) + ' из ' + p.total + '</span>');
    h.push('</div></div>');

    h.push('<textarea class="practice-textarea practice-js-entry" data-act="entry" rows="5" ' +
           'placeholder="Пиши как есть. Записи остаются в этом браузере и никуда не отправляются.">' + esc(draft) + '</textarea>');
    h.push('<div class="practice-actions practice-journal-actions">');
    h.push('<button type="button" class="btn" data-act="save-entry">Сохранить запись</button>');
    h.push('<span class="hint">пустая запись не сохраняется</span>');
    h.push('</div>');

    if (!j.length) {
      h.push('<p class="hint practice-empty">Пока пусто. Первая запись не обязана быть умной.</p>');
    } else {
      h.push('<ul class="practice-entries">');
      for (i = j.length - 1; i >= 0; i--) {
        e = j[i];
        h.push('<li class="practice-entry">');
        h.push('<div class="practice-entry-head">');
        h.push('<span class="practice-entry-date">' + esc(humanTime(e.ts)) + '</span>');
        if (e.prompt) h.push('<span class="practice-entry-prompt">' + esc(e.prompt) + '</span>');
        h.push('</div>');
        h.push('<div class="practice-entry-text">' + nl2br(e.text) + '</div>');
        h.push('<div class="practice-entry-actions">');
        if (armedEntry === i) {
          h.push('<button type="button" class="practice-link" data-act="del-2" data-i="' + i + '">точно удалить</button>');
          h.push('<button type="button" class="practice-link" data-act="del-cancel">отмена</button>');
        } else {
          h.push('<button type="button" class="practice-link" data-act="del-1" data-i="' + i + '">удалить</button>');
        }
        h.push('</div></li>');
      }
      h.push('</ul>');
      h.push('<p class="hint">записей: ' + j.length + '</p>');
    }

    h.push('</div>');
    return h.join('');
  }

  function dataHtml() {
    var h = [];
    h.push('<div class="practice-sec">');
    h.push('<h3 class="practice-h">Данные</h3>');
    h.push('<p class="hint">Всё хранится только в этом браузере. Экспорт — обычный файл: ' +
           '.md удобно читать, .json переносит состояние целиком.</p>');
    h.push('<div class="practice-actions">');
    h.push('<button type="button" class="btn-ghost" data-act="export-md">Экспорт .md</button>');
    h.push('<button type="button" class="btn-ghost" data-act="export-json">Экспорт .json</button>');
    h.push('</div>');
    h.push('<div class="practice-fallback" data-role="fallback" hidden>');
    h.push('<p class="hint">Скачивание в этом браузере недоступно — текст ниже можно скопировать вручную.</p>');
    h.push('<textarea class="practice-textarea" data-role="fallback-text" rows="8" readonly></textarea>');
    h.push('</div>');
    h.push('<div class="practice-danger">');
    if (!resetOpen) {
      h.push('<button type="button" class="practice-link" data-act="reset-1">Сбросить все данные</button>');
    } else {
      h.push('<p class="hint">Будут удалены все отметки, заметки и записи дневника. Вернуть их будет нельзя.</p>');
      h.push('<div class="practice-actions">');
      h.push('<button type="button" class="btn-ghost btn-s" data-act="reset-2">Удалить всё безвозвратно</button>');
      h.push('<button type="button" class="btn-ghost btn-s" data-act="reset-cancel">отмена</button>');
      h.push('</div>');
    }
    h.push('</div>');
    h.push('</div>');
    return h.join('');
  }

  function buildHtml() {
    var key = dateKey();
    var day = dayGet(key, false) || { marks: [], note: '' };
    var h = [];

    h.push('<div class="practice">');
    if (!storageOk) {
      h.push('<p class="practice-note">Локальное хранилище недоступно: браузер не разрешает сохранять данные. ' +
             'Отметки и записи будут жить до перезагрузки страницы.</p>');
    }
    h.push(todayHtml(key, day, day.marks));
    h.push(journalHtml());
    h.push(dataHtml());
    h.push('<p class="hint practice-status" data-role="status"></p>');
    h.push('</div>');
    return h.join('');
  }

  function render() {
    if (!rootEl) return;
    captureUi();
    rootEl.innerHTML = buildHtml();
  }

  /* Точечное обновление без перерисовки — чтобы не терять фокус на чекбоксе. */
  function refreshToday() {
    if (!rootEl) return;
    var el = rootEl.querySelector('[data-role="stats"]');
    if (el) el.textContent = statsLine();
    el = rootEl.querySelector('[data-role="streak-line"]');
    if (el) el.innerHTML = streakLine(streakCount());
  }

  /* ==================== события ==================== */

  function actNode(node) {
    while (node && node !== rootEl) {
      if (node.getAttribute && node.getAttribute('data-act')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function saveEntry() {
    if (!rootEl) return;
    var ta = rootEl.querySelector('.practice-js-entry');
    var text = trim(ta ? ta.value : draft);
    if (!text) {
      setStatus('Пустая запись не сохраняется — напиши хотя бы строку.');
      return;
    }
    addEntry(currentPrompt().text, text);
    /* чистим поле до перерисовки: иначе captureUi вернёт старый текст из DOM */
    if (ta) ta.value = '';
    draft = '';
    promptShift += 1;
    render();
    setStatus('Запись сохранена.');
  }

  function onCopyWater() {
    if (!rootEl) return;
    var water = waterOfDay(dateKey());
    var hint = rootEl.querySelector('[data-role="copy"]');
    copyText(water.text, function (ok) {
      var el = rootEl.querySelector('[data-role="copy"]');
      if (!el) el = hint;
      if (el) el.textContent = ok ? 'скопировано' : 'не удалось скопировать — выдели строку вручную';
      window.setTimeout(function () {
        if (el && el.parentNode) el.textContent = '';
      }, 4000);
    });
  }

  function onClick(ev) {
    var el = actNode(ev.target);
    if (!el) return;
    var act = el.getAttribute('data-act');
    var i;

    if (act === 'copy-water') { onCopyWater(); return; }

    if (act === 'demo') { openDemo(el.getAttribute('data-demo')); return; }

    if (act === 'next-prompt') {
      promptShift += 1;
      render();
      return;
    }

    if (act === 'save-entry') { saveEntry(); return; }

    if (act === 'del-1') {
      i = parseInt(el.getAttribute('data-i'), 10);
      armedEntry = isNaN(i) ? -1 : i;
      render();
      return;
    }
    if (act === 'del-2') {
      i = parseInt(el.getAttribute('data-i'), 10);
      deleteEntry(isNaN(i) ? -1 : i);
      return;
    }
    if (act === 'del-cancel') { armedEntry = -1; render(); return; }

    if (act === 'export-md') { doExport('md'); return; }
    if (act === 'export-json') { doExport('json'); return; }

    if (act === 'reset-1') { resetOpen = true; render(); return; }
    if (act === 'reset-2') { resetAll(); return; }
    if (act === 'reset-cancel') { resetOpen = false; render(); return; }
  }

  function onChange(ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    if (el.getAttribute('data-act') !== 'mark') return;
    var id = el.getAttribute('data-id');
    setMark(id, !!el.checked);

    var items = rootEl.querySelectorAll('.practice-item'), k;
    for (k = 0; k < items.length; k++) {
      if (items[k].getAttribute('data-id') === id) {
        if (el.checked) items[k].className += ' done';
        else items[k].className = items[k].className.replace(/(^|\s)done(?=\s|$)/, ' ');
      }
    }
    refreshToday();
  }

  function onInput(ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    var act = el.getAttribute('data-act');
    if (act === 'entry') draft = el.value;
    else if (act === 'note') setNote(el.value);
  }

  /* ==================== публичный API ==================== */

  function init(root, d) {
    var el = root;
    if (typeof el === 'string') {
      try { el = document.querySelector(el); } catch (e) { el = null; }
    }
    if (!el || !el.nodeType) {
      if (window.console && console.warn) console.warn('Practice: контейнер для рендера не найден');
      return false;
    }

    rootEl = el;
    if (d && typeof d === 'object') data = d;
    else if (window.REALITY_DATA) data = window.REALITY_DATA;
    else if (!data) data = {};

    if (!state) load();

    if (!el.getAttribute('data-practice-bound')) {
      el.setAttribute('data-practice-bound', '1');
      el.addEventListener('click', onClick, false);
      el.addEventListener('change', onChange, false);
      el.addEventListener('input', onInput, false);
    }

    draft = '';
    render();
    return true;
  }

  function addJournal(prompt, text) {
    if (!state) load();
    var entry = addEntry(prompt, text);
    if (!entry) return null;
    if (rootEl) {
      render();
      setStatus('Запись добавлена в дневник.');
    }
    return entry;
  }

  function getState() {
    if (!state) load();
    return state;
  }

  window.Practice = {
    init: init,
    addJournal: addJournal,
    getState: getState,
    storageKey: STORAGE_KEY
  };
})();
