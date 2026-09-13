/* ==========================================================================
   Это вода — app.js: навигация, рендер глав из REALITY_DATA, прогресс.
   Зависимости: js/data.js (обязателен), js/demos.js и js/practice.js (опциональны).
   ========================================================================== */
(function () {
  'use strict';

  var D = window.REALITY_DATA || null;

  var CHAPTERS = [
    { id: 'ch-intro',      n: '0', label: 'Вода',                     key: 'intro' },
    { id: 'ch-layers',     n: '1', label: 'Почти теорема',            key: 'layers' },
    { id: 'ch-candidates', n: '2', label: 'Жильцы ниши',              key: 'candidates' },
    { id: 'ch-routes',     n: '3', label: 'Как берут невидимое',      key: 'routes' },
    { id: 'ch-skeptics',   n: '4', label: 'Где всё ломается',         key: 'skeptics' },
    { id: 'ch-practice',   n: '5', label: 'Практика',                 key: 'practice' },
    { id: 'ch-sources',    n: '6', label: 'Источники',                key: 'sources' }
  ];

  var DEMO_TITLES = {
    troxler: 'Гаснущие пятна',
    blindspot: 'Слепое пятно',
    gorilla: 'Горилла',
    netineti: 'Нети нети',
    looking: 'Посмотри на то, что смотрит',
    contrast: 'Нет фона — нет фигуры',
    cut: 'Разрез фон Неймана'
  };

  var LS_PROGRESS = 'reality.progress.v1';
  var visited = {};

  /* ---------- утилиты ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function paras(arr) {
    var f = document.createDocumentFragment();
    (arr || []).forEach(function (t) { f.appendChild(h('p', null, esc(t))); });
    return f;
  }

  function badge(status) {
    var ok = /дослов/i.test(status || '');
    return '<span class="badge ' + (ok ? 'ok' : 'par') + '">' + (ok ? 'дословно' : 'парафраз') + '</span>';
  }

  function quoteEl(q) {
    var bq = h('blockquote', 'quote');
    bq.innerHTML = esc(q.text) + '<cite>' + esc(q.src || '') + ' ' + badge(q.status) + '</cite>';
    return bq;
  }

  function demoSlot(demoId, note) {
    var slot = h('div', 'demo-slot reveal');
    slot.setAttribute('data-demo-id', demoId);
    var title = DEMO_TITLES[demoId] || demoId;
    if (window.Demos && Demos.items && Demos.items[demoId] && Demos.items[demoId].title) {
      title = Demos.items[demoId].title;
    }
    slot.innerHTML =
      '<div class="demo-head">' +
        '<p class="kicker">демо</p>' +
        '<p class="demo-title">' + esc(title) + '</p>' +
        (note ? '<p class="hint">' + esc(note) + '</p>' : '') +
      '</div>' +
      '<div class="demo-body"></div>';
    return slot;
  }

  function section(key) {
    return document.querySelector('[data-chapter="' + key + '"]');
  }

  function chNum(sectionEl, n) {
    if (!sectionEl || !n || n === '0') return;
    sectionEl.appendChild(h('div', 'ch-num', esc(n)));
  }

  /* ---------- рендер глав ---------- */

  function renderIntro(sec) {
    var d = D.intro || {};
    sec.appendChild(h('p', 'kicker', esc(d.kicker || 'reality · вода')));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, esc((D.meta && D.meta.title) || 'Это вода')));
    if (D.meta && D.meta.subtitle) wrap.appendChild(h('p', 'lead', esc(D.meta.subtitle)));
    (d.lead || []).forEach(function (t) { wrap.appendChild(h('p', null, esc(t))); });
    if (d.fish && d.fish.text) {
      var fish = h('blockquote', 'quote');
      fish.innerHTML = esc(d.fish.text);
      wrap.appendChild(fish);
    }
    if (d.wallace) wrap.appendChild(quoteEl(d.wallace));

    if (d.howto && d.howto.length) {
      var ul = h('ul', 'hint');
      d.howto.forEach(function (t) { ul.appendChild(h('li', null, esc(t))); });
      wrap.appendChild(ul);
    }

    var btn = h('button', 'btn', 'начать: почему это почти теорема');
    btn.addEventListener('click', function () { go('ch-layers'); });
    wrap.appendChild(btn);

    sec.appendChild(wrap);
  }

  function renderLayers(sec) {
    sec.appendChild(h('p', 'kicker', 'глава 1 · пять слоёв'));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, 'Почему это почти теорема'));
    (D.layers || []).forEach(function (L) {
      var block = h('div', 'layer');
      block.appendChild(h('h3', null, esc(L.n + '. ' + L.title)));
      if (L.lead) block.appendChild(h('p', 'lead', esc(L.lead)));
      block.appendChild(paras(L.body));
      if (L.demo) block.appendChild(demoSlot(L.demo, L.demoNote));
      (L.quotes || []).forEach(function (q) { block.appendChild(quoteEl(q)); });
      (L.terms || []).forEach(function (t) {
        block.appendChild(h('p', 'hint', '<b>' + esc(t.term) + '</b> — ' + esc(t.def)));
      });
      wrap.appendChild(block);
    });
    sec.appendChild(wrap);
  }

  function renderCandidates(sec) {
    sec.appendChild(h('p', 'kicker', 'глава 2 · ниша и её жильцы'));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, 'Ниша и её жильцы'));
    wrap.appendChild(h('p', 'lead', 'Ниша гарантирована конститутивно — а вот на то, кто в ней живёт, претендуют несовместимые кандидаты.'));
    var grid = h('div', 'cards');
    (D.candidates || []).forEach(function (c) {
      var card = h('div', 'card');
      card.innerHTML =
        '<h4>' + esc(c.name) + '</h4>' +
        '<p class="sub">' + esc(c.subtitle || '') + '</p>' +
        '<p>' + esc(c.claim || '') + '</p>' +
        '<p class="hint">почему подходит: ' + esc(c.why || '') + '</p>' +
        '<p class="hint">ахиллесова пята: ' + esc(c.caveat || '') + '</p>' +
        '<div class="tags"><span class="chip">' + esc(c.tag || 'претендент') + '</span></div>';
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    sec.appendChild(wrap);
  }

  function renderRoutes(sec) {
    sec.appendChild(h('p', 'kicker', 'глава 3 · четыре маршрута'));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, 'Как невидимое всё-таки берут'));
    (D.routes || []).forEach(function (r) {
      var block = h('div', 'route');
      block.appendChild(h('h3', null, esc(r.n + '. ' + r.title)));
      if (r.lead) block.appendChild(h('p', 'lead', esc(r.lead)));
      block.appendChild(paras(r.body));
      if (r.demo) block.appendChild(demoSlot(r.demo, r.demoNote));
      (r.quotes || []).forEach(function (q) { block.appendChild(quoteEl(q)); });
      wrap.appendChild(block);
    });
    sec.appendChild(wrap);
  }

  function renderSkeptics(sec) {
    sec.appendChild(h('p', 'kicker', 'глава 4 · скепсис'));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, 'Где всё это ломается'));
    (D.skeptics || []).forEach(function (s, i) {
      var card = h('div', 'card');
      card.innerHTML =
        '<h4>' + (i + 1) + '. ' + esc(s.title) + '</h4>' +
        '<p>' + esc(s.body) + '</p>' +
        '<p class="hint"><b>что остаётся:</b> ' + esc(s.verdict || '') + '</p>' +
        (s.source ? '<p class="hint">' + esc(s.source) + '</p>' : '');
      wrap.appendChild(card);
    });

    // Итог
    var cl = (D.closing || {});
    if (cl.paragraphs && cl.paragraphs.length) {
      wrap.appendChild(h('hr', 'hr'));
      wrap.appendChild(h('h3', null, 'Итог'));
      wrap.appendChild(paras(cl.paragraphs));
      if (cl.wheeler) wrap.appendChild(quoteEl(cl.wheeler));
    }
    sec.appendChild(wrap);
  }

  function renderPractice(sec) {
    sec.appendChild(h('p', 'kicker', 'глава 5 · держать воду в поле внимания'));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, 'Практика'));
    wrap.appendChild(h('p', 'lead', 'Это ядро сайта: упражнения, вода дня, серии и дневник. Всё — только в этом браузере.'));
    var host = h('div', 'practice-host');
    wrap.appendChild(host);
    sec.appendChild(wrap);

    if (window.Practice && typeof Practice.init === 'function') {
      try { Practice.init(host, D); }
      catch (err) { host.appendChild(h('p', 'hint', 'Модуль практики упал при запуске: ' + esc(err && err.message || err))); }
    } else {
      host.appendChild(h('p', 'hint', 'Модуль практики не загружен (js/practice.js не найден).'));
    }
  }

  function renderSources(sec) {
    sec.appendChild(h('p', 'kicker', 'глава 6 · честность материала'));
    var wrap = h('div', 'reveal');
    wrap.appendChild(h('h2', null, 'Источники и честность'));
    var S = D.sources || {};
    if (S.intro) wrap.appendChild(h('p', 'lead', esc(S.intro)));

    if (S.table && S.table.length) {
      var tbl = h('table', 'tbl');
      var head = h('tr', null, '<th>что</th><th>где</th><th>статус</th>');
      var thead = h('thead', null, ''); thead.appendChild(head);
      tbl.appendChild(thead);
      var tbody = h('tbody');
      S.table.forEach(function (r) {
        var tr = h('tr');
        tr.innerHTML = '<td>' + esc(r.what) + '</td><td>' + esc(r.where) + '</td><td>' + badge(r.status) + '</td>';
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      wrap.appendChild(tbl);
    }

    if (S.honesty && S.honesty.length) {
      wrap.appendChild(h('h3', null, 'Честно'));
      var ul = h('ul', 'hint');
      S.honesty.forEach(function (t) { ul.appendChild(h('li', null, esc(t))); });
      wrap.appendChild(ul);
    }

    if (S.agents && S.agents.length) {
      wrap.appendChild(h('h3', null, 'Архив отчётов агентов'));
      var ul2 = h('ul', 'hint');
      S.agents.forEach(function (a) {
        ul2.appendChild(h('li', null,
          '<a href="' + esc(a.file) + '" target="_blank" rel="noopener">' +
          esc(a.n + '. ' + a.title) + '</a>' + (a.note ? ' — ' + esc(a.note) : '')));
      });
      wrap.appendChild(ul2);
    }

    if (D.meta) {
      wrap.appendChild(h('p', 'hint', 'версия ' + esc(D.meta.version || '0.1') + ' · собрано ' + esc(D.meta.built || '')));
    }
    sec.appendChild(wrap);
  }

  function renderNoData() {
    CHAPTERS.forEach(function (c) {
      var sec = document.getElementById(c.id);
      if (sec) sec.appendChild(h('p', 'hint', 'Данные не загружены: js/data.js отсутствует или упал.'));
    });
  }

  /* ---------- монтирование демо ---------- */

  function mountDemos(root) {
    var slots = root.querySelectorAll('.demo-slot[data-demo-id]');
    Array.prototype.forEach.call(slots, function (slot) {
      var id = slot.getAttribute('data-demo-id');
      var body = slot.querySelector('.demo-body');
      if (!body) return;
      if (!window.Demos || typeof Demos.has !== 'function' || !Demos.has(id)) {
        body.innerHTML = '<p class="hint">Демо «' + esc(id) + '» не загружено (js/demos.js не найден).</p>';
        return;
      }
      try { Demos.mount(id, body, {}); }
      catch (err) {
        body.innerHTML = '<p class="hint">Демо не запустилось: ' + esc(err && err.message || err) + '</p>';
      }
    });
  }

  /* ---------- навигация и прогресс ---------- */

  function buildNav() {
    var rail = document.getElementById('rail');
    var mnav = document.getElementById('mnav');
    if (rail) {
      CHAPTERS.forEach(function (c) {
        var a = h('a', null, '<span class="n">' + c.n + '</span><span>' + esc(c.label) + '</span>');
        a.href = '#' + c.id;
        a.setAttribute('data-target', c.id);
        rail.appendChild(a);
      });
      rail.appendChild(h('div', 'rail-foot', 'прогресс и дневник хранятся в этом браузере.'));
    }
    if (mnav) {
      CHAPTERS.forEach(function (c) {
        var a = h('a', null, esc(c.label));
        a.href = '#' + c.id;
        a.setAttribute('data-target', c.id);
        mnav.appendChild(a);
      });
    }
  }

  function setActive(id) {
    ['rail', 'mnav'].forEach(function (navId) {
      var nav = document.getElementById(navId);
      if (!nav) return;
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
        var on = a.getAttribute('data-target') === id;
        a.classList.toggle('active', on);
        if (a.classList.contains('done') === false && visited[a.getAttribute('data-target')]) {
          a.classList.add('done');
        }
      });
    });
  }

  function updateProgress() {
    var total = CHAPTERS.length;
    var done = 0;
    CHAPTERS.forEach(function (c) { if (visited[c.id]) done++; });
    var fill = document.getElementById('progressFill');
    if (fill) fill.style.width = Math.round(100 * done / total) + '%';
    ['rail', 'mnav'].forEach(function (navId) {
      var nav = document.getElementById(navId);
      if (!nav) return;
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
        a.classList.toggle('done', !!visited[a.getAttribute('data-target')]);
      });
    });
  }

  function markVisited(id) {
    if (!id || visited[id]) return;
    visited[id] = 1;
    try { localStorage.setItem(LS_PROGRESS, JSON.stringify(visited)); } catch (e) { /* приватный режим */ }
    updateProgress();
  }

  function go(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
    markVisited(id);
  }

  window.App = {
    go: go,
    openDemo: function (demoId) {
      var slot = document.querySelector('.demo-slot[data-demo-id="' + demoId + '"]');
      if (!slot) return false;
      var chapter = slot.closest('.chapter');
      if (chapter) { markVisited(chapter.id); setActive(chapter.id); }
      slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      slot.classList.remove('flash');
      void slot.offsetWidth; // перезапуск анимации
      slot.classList.add('flash');
      return true;
    },
    visited: function () { return Object.keys(visited); }
  };

  /* ---------- наблюдатели ---------- */

  function setupReveal() {
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (e) { e.classList.add('on'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (e) { io.observe(e); });
  }

  function setupActive() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var id = en.target.id;
          setActive(id);
          markVisited(id);
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    CHAPTERS.forEach(function (c) {
      var sec = document.getElementById(c.id);
      if (sec) io.observe(sec);
    });
  }

  /* ---------- инициализация ---------- */

  function init() {
    try { visited = JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}') || {}; } catch (e) { visited = {}; }

    buildNav();
    updateProgress();

    if (!D) { renderNoData(); return; }

    var ok = ['intro', 'layers', 'candidates', 'routes', 'skeptics', 'practice', 'sources'];
    var renderers = {
      intro: renderIntro, layers: renderLayers, candidates: renderCandidates,
      routes: renderRoutes, skeptics: renderSkeptics, practice: renderPractice, sources: renderSources
    };
    ok.forEach(function (key) {
      var sec = section(key);
      if (!sec) return;
      try { renderers[key](sec); chNum(sec, (CHAPTERS.find(function (c) { return c.key === key; }) || {}).n); }
      catch (err) { sec.appendChild(h('p', 'hint', 'Глава не отрисовалась: ' + esc(err && err.message || err))); }
    });

    mountDemos(document);
    setupReveal();
    setupActive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
