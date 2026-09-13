/* ==========================================================================
   Это вода · js/demos.js — семь интерактивных демо (window.Demos)
   Классический скрипт без зависимостей: работает и по file://.

   Контракт:
     Demos.has(id)              → есть ли демо с таким id
     Demos.mount(id, el, opts)  → экземпляр { destroy() } или null
     Demos.items[id]            → { id, title, mount(el, opts) }

   Экземпляры независимы: одно демо можно смонтировать несколько раз.
   Анимация идёт только пока контейнер видим (IntersectionObserver),
   иначе демо тихо ждёт. Стили — в css/demos.css, префикс demo-.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var MAX_DPR = 3;
  var DEG = Math.PI / 180;
  var CM_PER_PX = 2.54 / 96;   // грубая оценка: 96 px на дюйм
  var VIEW_CM = 50;            // экран примерно на вытянутой руке

  /* ======================= утилиты ======================= */

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(text, cls) {
    var b = node('button', cls || 'btn btn-s', text);
    b.type = 'button';
    return b;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Цвета берём из CSS-токенов (палитра — публичный договор проекта).
     Если style.css не подключён, работают запасные значения. */
  var TOKEN_NAMES = {
    bg: '--bg', bg2: '--bg-2', panel: '--panel', panel2: '--panel-2',
    ink: '--ink', inkDim: '--ink-dim', muted: '--muted',
    accent: '--accent', water: '--water', ok: '--ok', warn: '--warn'
  };
  var TOKEN_FALLBACK = {
    bg: '#0a0f17', bg2: '#0d1522', panel: '#101b2b', panel2: '#142134',
    ink: '#e9e5da', inkDim: '#c2c8d4', muted: '#8d99ad',
    accent: '#e9c46a', water: '#7fb3d5', ok: '#8fc8a0', warn: '#e8a06a'
  };
  var THEME = null;

  function token(name) {
    if (!THEME) {
      THEME = {};
      var cs = null;
      try { cs = window.getComputedStyle(document.documentElement); } catch (e) { cs = null; }
      Object.keys(TOKEN_FALLBACK).forEach(function (k) {
        var v = cs ? String(cs.getPropertyValue(TOKEN_NAMES[k]) || '').trim() : '';
        THEME[k] = v || TOKEN_FALLBACK[k];
      });
    }
    return THEME[name] || TOKEN_FALLBACK[name] || '#000';
  }

  function toRgb(color) {
    var c = String(color || '').trim();
    if (c.charAt(0) === '#') {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h.slice(0, 6), 16);
      if (!isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = c.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var p = m[1].split(',');
      return [parseFloat(p[0]) || 0, parseFloat(p[1]) || 0, parseFloat(p[2]) || 0];
    }
    return [0, 0, 0];
  }

  /* t = 0 → цвет a, t = 1 → цвет b */
  function mix(a, b, t) {
    var A = toRgb(a), B = toRgb(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' +
      Math.round(lerp(A[1], B[1], t)) + ',' +
      Math.round(lerp(A[2], B[2], t)) + ')';
  }

  function mmss(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function num(value, digits) {
    return String(Number(value).toFixed(digits == null ? 1 : digits)).replace('.', ',');
  }

  /* Мягкая смена текста без мигания */
  function fadeText(demo, target, text) {
    if (!target || target.textContent === text) return;
    target.classList.add('is-fading');
    demo.timeout(function () {
      target.textContent = text;
      target.classList.remove('is-fading');
    }, 150);
  }

  /* ======================= базовый экземпляр ======================= */

  function Demo(id, host, opts) {
    this.id = id;
    this.el = host;                 // контейнер, внутри которого всё рисуется
    this.opts = opts || {};
    this.root = node('div', 'demo demo-' + id);
    host.appendChild(this.root);

    this.destroyed = false;
    this.visible = false;
    this._step = null;
    this._wantLoop = false;
    this._raf = 0;
    this._last = 0;
    this._timers = [];
    this._off = [];
    this._obs = [];

    this._watchVisible();
  }

  /* --- слушатели и таймеры: всё снимается в destroy() --- */

  Demo.prototype.on = function (target, type, fn, o) {
    target.addEventListener(type, fn, o || false);
    this._off.push([target, type, fn, o || false]);
    return this;
  };

  Demo.prototype.timeout = function (fn, ms) {
    var self = this;
    var t = window.setTimeout(function () {
      self._timers = self._timers.filter(function (x) { return x !== t; });
      if (!self.destroyed) fn();
    }, ms);
    this._timers.push(t);
    return t;
  };

  /* --- цикл анимации: идёт только пока контейнер видим --- */

  Demo.prototype.loop = function (step) {
    this._step = step;
    this._wantLoop = true;
    this._sync();
    return this;
  };

  Demo.prototype.pause = function () {
    this._wantLoop = false;
    this._sync();
    return this;
  };

  Demo.prototype._sync = function () {
    var want = this._wantLoop && this.visible && !this.destroyed;
    if (want && !this._raf) {
      var self = this;
      this._last = 0;
      this._raf = window.requestAnimationFrame(function (ts) { self._frame(ts); });
    } else if (!want && this._raf) {
      window.cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  };

  Demo.prototype._frame = function (ts) {
    this._raf = 0;
    if (this.destroyed || !this.visible) return;   // ушло с экрана — тихо ждём
    var dt = this._last ? Math.min((ts - this._last) / 1000, 0.1) : 0;
    this._last = ts;
    if (this._step) this._step(dt);
    if (this._wantLoop && !this.destroyed) {
      var self = this;
      this._raf = window.requestAnimationFrame(function (t) { self._frame(t); });
    }
  };

  Demo.prototype._watchVisible = function () {
    var self = this;
    if (!window.IntersectionObserver) { this.visible = true; return; }
    this._io = new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      if (!e) return;
      self.visible = !!e.isIntersecting;
      self._sync();
    }, { rootMargin: '120px 0px 120px 0px', threshold: 0 });
    this._io.observe(this.el);
    this._obs.push(this._io);
  };

  /* --- завершение: необязательный колбэк из opts --- */

  Demo.prototype.complete = function (payload) {
    if (typeof this.opts.onComplete === 'function') {
      try { this.opts.onComplete(payload); }
      catch (e) { if (window.console && console.error) console.error(e); }
    }
  };

  Demo.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this._raf) { window.cancelAnimationFrame(this._raf); this._raf = 0; }
    this._timers.forEach(function (t) { window.clearTimeout(t); window.clearInterval(t); });
    this._timers = [];
    this._off.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    this._off = [];
    this._obs.forEach(function (o) { if (o.disconnect) o.disconnect(); });
    this._obs = [];
    if (this.el && this.el.__demo === this) this.el.__demo = null;
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  };

  /* ======================= canvas с учётом devicePixelRatio ======================= */

  function canvasBox(demo, parent, opts) {
    opts = opts || {};
    var canvas = node('canvas', 'demo-canvas');
    canvas.setAttribute('role', 'img');
    if (opts.label) canvas.setAttribute('aria-label', opts.label);
    parent.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var box = { canvas: canvas, ctx: ctx, w: 0, h: 0, dpr: 1, onResize: null };

    box.measure = function () {
      var w = Math.max(200, Math.round(canvas.clientWidth || parent.clientWidth || 320));
      var h = Math.max(opts.minHeight || 120,
        Math.round(opts.height ? opts.height(w) : w * (opts.aspect || 0.6)));
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (box.w === w && box.h === h && box.dpr === dpr) return false;
      box.w = w; box.h = h; box.dpr = dpr;
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // дальше рисуем в CSS-пикселях
      return true;
    };

    var relayout = function () {
      if (box.measure() && box.onResize) box.onResize();
    };
    box.relayout = relayout;

    if (window.ResizeObserver) {
      box.ro = new window.ResizeObserver(relayout);
      box.ro.observe(parent);
      demo._obs.push(box.ro);
    } else {
      demo.on(window, 'resize', relayout);
    }
    relayout();
    return box;
  }

  /* ======================= 1. troxler — «Гаснущие пятна» ======================= */

  /* Десять пятен вокруг центра: внешнее кольцо и внутреннее. */
  var TROXLER_DOTS = [
    { a: 10, r: 1.00, s: 9, c: '#7fb3d5' },
    { a: 70, r: 1.00, s: 8, c: '#e9c46a' },
    { a: 130, r: 1.00, s: 10, c: '#8fc8a0' },
    { a: 190, r: 1.00, s: 8, c: '#e8a06a' },
    { a: 250, r: 1.00, s: 9, c: '#b7a4d6' },
    { a: 310, r: 1.00, s: 8, c: '#7fb3d5' },
    { a: 40, r: 0.56, s: 7, c: '#e9c46a' },
    { a: 130, r: 0.56, s: 7, c: '#8fc8a0' },
    { a: 220, r: 0.56, s: 7, c: '#e8a06a' },
    { a: 310, r: 0.56, s: 7, c: '#b7a4d6' }
  ];

  function TroxlerDemo(host, opts) {
    Demo.call(this, 'troxler', host, opts);
    var self = this;
    this.idle = 0;      // секунд без движения
    this.fade = 1;      // 1 — пятна видны, 0 — погасли
    this.reported = false;

    this.root.appendChild(node('p', 'demo-lead', 'Зафиксируй взгляд на кресте и не двигай глазами.'));
    this.root.appendChild(node('p', 'demo-hint',
      'Периферийные пятна гаснут, если взгляд стоит. Движение мыши — грубая замена движению глаз: сдвинул мышь — пятна вернулись.'));

    this.box = canvasBox(this, this.root, {
      aspect: 0.52, minHeight: 220,
      label: 'Крест в центре, вокруг — десять цветных пятен'
    });
    this.box.onResize = function () { self.draw(); };

    var row = node('div', 'demo-row');
    this.label = node('span', 'demo-label', '');
    this.slider = node('input', 'demo-slider');
    this.slider.type = 'range';
    this.slider.min = '5';
    this.slider.max = '40';
    this.slider.step = '1';
    this.slider.value = '20';
    this.slider.setAttribute('aria-label', 'Время без движения до угасания, секунды');
    row.appendChild(this.label);
    row.appendChild(this.slider);
    this.root.appendChild(row);

    var row2 = node('div', 'demo-row');
    this.status = node('span', 'demo-readout demo-fade', '');
    this.resetBtn = button('Начать заново', 'btn-ghost btn-s');
    row2.appendChild(this.status);
    row2.appendChild(this.resetBtn);
    this.root.appendChild(row2);

    this.root.appendChild(node('p', 'demo-note', 'Упрощённая реплика; оригинал — эффект Трокслера, 1804.'));

    var activity = function () { self.idle = 0; };
    this.on(document, 'pointermove', activity);
    this.on(document, 'pointerdown', activity);
    this.on(document, 'keydown', activity);
    this.on(this.el, 'touchmove', activity);
    this.on(window, 'scroll', activity, true);
    this.on(this.resetBtn, 'click', function () { self.idle = 0; self.fade = 1; });
    this.on(this.slider, 'input', function () { self.updateLabel(); });

    this.updateLabel();
    this.updateStatus(true);
    this.loop(function (dt) { self.step(dt); });
    this.draw();
  }
  TroxlerDemo.prototype = Object.create(Demo.prototype);
  TroxlerDemo.prototype.constructor = TroxlerDemo;

  TroxlerDemo.prototype.delay = function () {
    return clamp(Number(this.slider.value) || 20, 5, 40);
  };

  TroxlerDemo.prototype.updateLabel = function () {
    this.label.textContent = 'Время без движения до угасания: ' + this.delay() + ' с';
  };

  TroxlerDemo.prototype.updateStatus = function (force) {
    var delay = this.delay();
    var state = this.fade < 0.05 ? 'погасли'
      : this.fade < 0.9 ? (this.idle >= delay ? 'гаснут' : 'возвращаются')
        : 'видны';
    var text = 'Пятна: ' + state + ' · без движения ' + num(this.idle, 1) + ' с';
    if (force || this._statusText !== text) {
      this._statusText = text;
      fadeText(this, this.status, text);
    }
  };

  TroxlerDemo.prototype.step = function (dt) {
    var delay = this.delay();
    this.idle += dt;
    var target = this.idle >= delay ? 0 : 1;
    var tau = target > this.fade ? 0.4 : 1.3;   // возврат быстрый, угасание медленное
    this.fade += (target - this.fade) * (1 - Math.exp(-dt / tau));
    if (target === 0 && this.fade < 0.03 && !this.reported) {
      this.reported = true;
      this.complete({
        demo: 'troxler', delay: delay,
        seconds: Math.round(this.idle), dots: TROXLER_DOTS.length
      });
    }
    this.updateStatus(false);
    this.draw();
  };

  TroxlerDemo.prototype.draw = function () {
    var b = this.box, ctx = b.ctx, w = b.w, h = b.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = token('bg2');
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    var R = Math.min(w * 0.36, h * 0.42);
    var scale = clamp(w / 620, 0.7, 1.6);

    ctx.globalAlpha = this.fade;
    TROXLER_DOTS.forEach(function (d) {
      var a = (d.a - 90) * DEG;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * d.r, cy + Math.sin(a) * R * d.r, Math.max(6, d.s * scale), 0, Math.PI * 2);
      ctx.fillStyle = d.c;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // крест — точка фиксации, она не гаснет
    var arm = Math.max(12, 15 * scale);
    ctx.strokeStyle = token('ink');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = token('accent');
    ctx.fill();
  };

  /* ======================= 2. blindspot — «Найди своё слепое пятно» ======================= */

  function BlindSpotDemo(host, opts) {
    Demo.call(this, 'blindspot', host, opts);
    var self = this;

    this.root.appendChild(node('p', 'demo-lead', 'Закрой правый глаз. Левый держи на кресте — точка слева исчезнет.'));
    this.root.appendChild(node('p', 'demo-hint',
      'Меняй отступ медленно и не переводи взгляд на точку: она исчезает как раз тогда, когда смотришь мимо неё.'));

    this.box = canvasBox(this, this.root, {
      aspect: 0.34, minHeight: 150,
      label: 'Крест справа и точка слева от него'
    });
    this.box.onResize = function () { self.draw(); };

    var row = node('div', 'demo-row');
    this.label = node('span', 'demo-label', '');
    this.slider = node('input', 'demo-slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.step = '1';
    this.slider.value = '62';
    this.slider.setAttribute('aria-label', 'Отступ точки от креста');
    row.appendChild(this.label);
    row.appendChild(this.slider);
    this.root.appendChild(row);

    var row2 = node('div', 'demo-row');
    this.readout = node('span', 'demo-readout demo-fade', '');
    this.okBtn = button('Получилось', 'btn btn-s');
    row2.appendChild(this.readout);
    row2.appendChild(this.okBtn);
    this.root.appendChild(row2);

    this.mark = node('p', 'demo-hint', '');
    this.mark.hidden = true;
    this.root.appendChild(this.mark);

    this.root.appendChild(node('p', 'demo-note',
      'Слепое пятно — проекция диска зрительного нерва: около 12–15° к виску от точки фиксации. Мозг достраивает пропуск, поэтому пропуск не выглядит пропуском.'));
    this.root.appendChild(node('p', 'demo-note',
      'Если точка не исчезает: сядь чуть дальше или ближе и веди ползунок медленно. На узком экране нужного угла может не хватить — это ограничение экрана, а не глаза.'));

    this.on(this.slider, 'input', function () { self.update(); });
    this.on(this.okBtn, 'click', function () {
      self.mark.hidden = false;
      self.mark.textContent = 'Отмечено: отступ ' + self.offset() + ' px ≈ ' + num(self.degrees(), 1) + '°.';
      self.complete({ demo: 'blindspot', offsetPx: self.offset(), degrees: Number(self.degrees().toFixed(1)) });
    });

    this.update();
    this.draw();
  }
  BlindSpotDemo.prototype = Object.create(Demo.prototype);
  BlindSpotDemo.prototype.constructor = BlindSpotDemo;

  BlindSpotDemo.prototype.crossX = function () {
    return Math.max(this.box.w * 0.76, this.box.w - 110);
  };

  BlindSpotDemo.prototype.maxOffset = function () {
    return Math.max(110, this.crossX() - 46);
  };

  BlindSpotDemo.prototype.offset = function () {
    var t = clamp(Number(this.slider.value) / 100, 0, 1);
    return Math.round(lerp(46, this.maxOffset(), t));
  };

  /* Угол между точкой фиксации и точкой, в градусах (при экране ~50 см). */
  BlindSpotDemo.prototype.degrees = function () {
    return Math.atan((this.offset() * CM_PER_PX) / VIEW_CM) / DEG;
  };

  BlindSpotDemo.prototype.update = function () {
    var deg = this.degrees();
    var inZone = deg >= 11.5 && deg <= 16.5;
    this.label.textContent = 'Отступ: ' + this.offset() + ' px';
    this.readout.textContent = '≈ ' + num(deg, 1) + '°' + (inZone ? ' — рабочая зона' : ' от точки фиксации');
    this.readout.classList.toggle('zone', inZone);
    this.draw();
  };

  BlindSpotDemo.prototype.draw = function () {
    var b = this.box, ctx = b.ctx, w = b.w, h = b.h;
    var ink = token('ink'), accent = token('accent'), muted = token('muted');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = token('bg2');
    ctx.fillRect(0, 0, w, h);

    var cx = this.crossX(), cy = h / 2;
    var dx = cx - this.offset();
    var arm = Math.max(10, Math.min(18, h * 0.09));

    // крест
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();

    // точка слева от креста
    ctx.beginPath();
    ctx.arc(dx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    // подписи
    ctx.fillStyle = muted;
    ctx.font = '12px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('крест', cx, cy + arm + 18);
    ctx.fillText('точка', dx, cy + arm + 18);
  };

  /* ======================= 3. gorilla — «Горилла» ======================= */

  function GorillaDemo(host, opts) {
    Demo.call(this, 'gorilla', host, opts);
    var self = this;

    this.speed = 1;          // 1 — обычный раунд, 0.6 — повтор с подсказкой
    this.hinted = false;
    this.phase = 'idle';     // idle → round → gorilla → done
    this.t = 0;
    this.lightPasses = 0;
    this.darkPasses = 0;
    this.passTarget = 9;
    this.answer = { noticed: null, count: null };

    this.root.appendChild(node('p', 'demo-lead', 'Считай передачи светлой команды.'));
    this.status = node('p', 'demo-hint',
      'Светлые перебрасывают мяч между собой, тёмные — между собой. Считай передачи светлых.');
    this.root.appendChild(this.status);

    this.box = canvasBox(this, this.root, {
      aspect: 0.56, minHeight: 230,
      label: 'Четыре фигуры перебрасывают два мяча по сцене'
    });
    this.box.onResize = function () { self.draw(); };

    this.row = node('div', 'demo-row');
    this.startBtn = button('Начать раунд', 'btn btn-s');
    this.row.appendChild(this.startBtn);
    this.root.appendChild(this.row);

    this.panel = node('div', 'demo-final');
    this.panel.hidden = true;
    this.root.appendChild(this.panel);

    this.root.appendChild(node('p', 'demo-note',
      'Саймонс—Чабрис, 1999: 46% не замечают; ни один из незаметивших не «вспомнил» гориллу, пока запись не прокрутили заново. Это демонстрация «второй модели»: прозрачное становится видимым не всматриванием, а вторым набором данных для сверки.'));

    this.on(this.startBtn, 'click', function () {
      if (self.phase === 'idle') self.startRound(false);
      else if (self.phase === 'round' || self.phase === 'gorilla') self.finishRound(true);
      else self.startRound(false);
    });

    this.resetFigures();
    this.draw();
  }
  GorillaDemo.prototype = Object.create(Demo.prototype);
  GorillaDemo.prototype.constructor = GorillaDemo;

  GorillaDemo.prototype.resetFigures = function () {
    this.figures = [
      { team: 'light', x: 0.28, y: 0.32, tx: 0.34, ty: 0.28, v: 0.085 },
      { team: 'light', x: 0.42, y: 0.68, tx: 0.40, ty: 0.74, v: 0.075 },
      { team: 'dark', x: 0.74, y: 0.36, tx: 0.70, ty: 0.40, v: 0.09 },
      { team: 'dark', x: 0.62, y: 0.74, tx: 0.66, ty: 0.70, v: 0.08 }
    ];
    // у каждой команды свой мяч
    this.passing = {
      light: { owner: 0, nextAt: 1.0, flight: null },
      dark: { owner: 2, nextAt: 0.6, flight: null }
    };
    this.gorilla = null;
    this.gorillaSeen = false;
    this.t = 0;
    this.lightPasses = 0;
    this.darkPasses = 0;
  };

  GorillaDemo.prototype.startRound = function (hint) {
    var self = this;
    this.hinted = !!hint;
    this.speed = hint ? 0.6 : 1;
    this.phase = 'round';
    this.passTarget = 8 + Math.floor(Math.random() * 3);   // 8–10 передач светлых
    this.answer = { noticed: null, count: null };
    this.resetFigures();
    this.panel.hidden = true;
    this.panel.innerHTML = '';
    this.startBtn.textContent = 'Завершить раунд';
    this.status.textContent = 'Раунд идёт. Считай передачи светлой команды.';
    this._statusText = null;
    this.loop(function (dt) { self.step(dt); });
    this.draw();
  };

  GorillaDemo.prototype.finishRound = function (early) {
    this.phase = 'done';
    this.startBtn.textContent = 'Заново';
    this.status.textContent = early
      ? 'Раунд завершён досрочно. Осталось ответить на два вопроса.'
      : 'Раунд закончен. Осталось ответить на два вопроса.';
    this._statusText = null;
    this.pause();
    this.showQuestions(early);
    this.draw();
  };

  GorillaDemo.prototype.moveFigures = function (s) {
    this.figures.forEach(function (f) {
      var dx = f.tx - f.x, dy = f.ty - f.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.03) {
        f.tx = 0.12 + Math.random() * 0.76;
        f.ty = 0.14 + Math.random() * 0.72;
      } else {
        f.x += (dx / d) * f.v * (f.team === 'dark' ? 1.15 : 1) * s;
        f.y += (dy / d) * f.v * (f.team === 'dark' ? 1.15 : 1) * s;
      }
      f.x = clamp(f.x, 0.07, 0.93);
      f.y = clamp(f.y, 0.12, 0.88);
    });
    // слегка разводим фигуры, чтобы не сливались
    var figs = this.figures;
    for (var i = 0; i < figs.length; i++) {
      for (var j = i + 1; j < figs.length; j++) {
        var a = figs[i], b = figs[j];
        var ddx = b.x - a.x, ddy = b.y - a.y;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
        if (dist < 0.17) {
          var push = (0.17 - dist) / 2;
          a.x -= (ddx / dist) * push; a.y -= (ddy / dist) * push;
          b.x += (ddx / dist) * push; b.y += (ddy / dist) * push;
        }
      }
    }
  };

  GorillaDemo.prototype.pass = function (team, s) {
    var p = this.passing[team];
    if (p.flight) {
      p.flight.t += s / p.flight.dur;
      if (p.flight.t >= 1) {
        p.owner = p.flight.to;
        p.flight = null;
        p.nextAt = this.t + 0.5 + Math.random() * 0.5;
        if (team === 'light') this.lightPasses++; else this.darkPasses++;
      }
      return;
    }
    if (this.t < p.nextAt) return;
    var from = p.owner;
    var mates = [];
    for (var i = 0; i < this.figures.length; i++) {
      if (i !== from && this.figures[i].team === team) mates.push(i);
    }
    if (!mates.length) return;
    var to = mates[Math.floor(Math.random() * mates.length)];
    p.flight = {
      to: to, t: 0, dur: 0.5 + Math.random() * 0.25,
      fx: this.figures[from].x, fy: this.figures[from].y
    };
    p.owner = to;
  };

  GorillaDemo.prototype.startGorilla = function () {
    this.phase = 'gorilla';
    this.gorillaSeen = true;
    this.gorilla = { x: -0.12, y: 0.45, vx: 1.24 / 5 };   // проходит сцену за ~5 с
  };

  GorillaDemo.prototype.updateStatus = function () {
    var text;
    if (this.phase === 'round') {
      text = 'Раунд идёт · ' + mmss(this.t) + ' · считай передачи светлой команды.';
    } else if (this.phase === 'gorilla') {
      text = this.hinted
        ? 'Повтор (0,6×) · горилла подсвечена · светлых передач: ' + this.lightPasses
        : 'Раунд идёт · ' + mmss(this.t) + ' · считай передачи светлой команды.';
    } else {
      return;
    }
    if (this._statusText !== text) {
      this._statusText = text;
      this.status.textContent = text;   // без плавного затухания: строка меняется часто
    }
  };

  GorillaDemo.prototype.step = function (dt) {
    if (this.phase !== 'round' && this.phase !== 'gorilla') return;
    var s = dt * this.speed;
    this.t += s;
    this.moveFigures(s);
    this.pass('light', s);
    this.pass('dark', s);

    if (this.phase === 'round' && (this.lightPasses >= this.passTarget || (this.t > 40 && this.lightPasses >= 4))) {
      this.startGorilla();
    }
    if (this.gorilla) {
      this.gorilla.x += this.gorilla.vx * s;
      if (this.gorilla.x > 1.14) {
        this.gorilla = null;
        this.finishRound(false);
        return;
      }
    }
    this.updateStatus();
    this.draw();
  };

  GorillaDemo.prototype.figureRadius = function () {
    return clamp(Math.min(this.box.w, this.box.h) * 0.058, 11, 20);
  };

  GorillaDemo.prototype.px = function (f) {
    return { x: f.x * this.box.w, y: f.y * this.box.h };
  };

  GorillaDemo.prototype.draw = function () {
    var b = this.box, ctx = b.ctx, w = b.w, h = b.h;
    var light = token('ink'), accent = token('accent'), dark = '#33465e';
    var r = this.figureRadius();

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = token('bg2');
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(233,229,218,.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    var self = this;

    // фигуры
    this.figures.forEach(function (f) {
      var at = self.px(f);
      ctx.beginPath();
      ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      if (f.team === 'light') {
        ctx.fillStyle = light;
      } else {
        ctx.fillStyle = dark;
      }
      ctx.fill();
      if (f.team === 'dark') {
        ctx.strokeStyle = 'rgba(233,229,218,.28)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // мячи
    ['light', 'dark'].forEach(function (team) {
      var p = self.passing[team];
      if (!p) return;
      var pos = null;
      if (p.flight) {
        var to = self.figures[p.flight.to];
        var t = clamp(p.flight.t, 0, 1);
        var arc = Math.sin(Math.PI * t) * 0.055;
        pos = {
          x: lerp(p.flight.fx, to.x, t) * w,
          y: (lerp(p.flight.fy, to.y, t) - arc) * h
        };
      } else {
        var owner = self.figures[p.owner];
        if (!owner) return;
        var o = self.px(owner);
        pos = { x: o.x + r * 0.95, y: o.y - r * 0.95 };
      }
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, Math.max(4, r * 0.42), 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
    });

    // горилла: тёмная фигура с контуром
    if (this.gorilla) {
      var g = this.gorilla;
      var gx = g.x * w;
      var gy = (g.y + Math.sin(this.t * 7) * 0.012) * h;
      var gr = r * 1.45;
      var hint = this.hinted;

      if (hint) {
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur = 18;
      }
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fillStyle = '#182534';
      ctx.fill();
      ctx.lineWidth = hint ? 2.5 : 1.8;
      ctx.strokeStyle = hint ? accent : 'rgba(233,229,218,.6)';
      ctx.stroke();
      // уши
      ctx.beginPath();
      ctx.arc(gx - gr * 0.85, gy - gr * 0.72, gr * 0.34, 0, Math.PI * 2);
      ctx.arc(gx + gr * 0.85, gy - gr * 0.72, gr * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = '#182534';
      ctx.fill();
      ctx.stroke();
      // лапы
      ctx.beginPath();
      ctx.moveTo(gx - gr * 0.55, gy + gr * 0.72);
      ctx.lineTo(gx - gr * 0.95, gy + gr * 1.25);
      ctx.moveTo(gx + gr * 0.55, gy + gr * 0.72);
      ctx.lineTo(gx + gr * 0.95, gy + gr * 1.25);
      ctx.stroke();
      if (hint) ctx.restore();

      if (hint) {
        ctx.fillStyle = accent;
        ctx.font = '12px system-ui, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('горилла', gx, gy - gr - 8);
      }
    }
  };

  GorillaDemo.prototype.showQuestions = function (early) {
    var self = this;
    var panel = this.panel;
    panel.hidden = false;
    panel.innerHTML = '';

    var head = node('p', 'demo-final-lead', early ? 'Раунд закончен досрочно.' : 'Раунд закончен.');
    panel.appendChild(head);

    panel.appendChild(node('p', 'demo-q', 'Заметили ли вы что-нибудь необычное в сцене?'));
    var opts = node('div', 'demo-row');
    var yes = button('Да', 'demo-opt');
    var no = button('Нет', 'demo-opt');
    yes.setAttribute('aria-pressed', 'false');
    no.setAttribute('aria-pressed', 'false');
    opts.appendChild(yes);
    opts.appendChild(no);
    panel.appendChild(opts);

    panel.appendChild(node('p', 'demo-q', 'Сколько передач светлой команды вы насчитали?'));
    var numRow = node('div', 'demo-row');
    var input = node('input', 'demo-num');
    input.type = 'number';
    input.min = '0';
    input.max = '99';
    input.value = '';
    input.setAttribute('aria-label', 'Сколько передач светлой команды вы насчитали');
    numRow.appendChild(input);
    panel.appendChild(numRow);

    var actions = node('div', 'demo-row');
    var check = button('Проверить', 'btn btn-s');
    actions.appendChild(check);
    panel.appendChild(actions);

    var warn = node('p', 'demo-hint', '');
    panel.appendChild(warn);

    function pick(noticed, btn) {
      self.answer.noticed = noticed;
      yes.setAttribute('aria-pressed', noticed === true ? 'true' : 'false');
      no.setAttribute('aria-pressed', noticed === false ? 'true' : 'false');
      void btn;
    }
    this.on(yes, 'click', function () { pick(true, yes); });
    this.on(no, 'click', function () { pick(false, no); });

    this.on(check, 'click', function () {
      var raw = input.value.trim();
      if (self.answer.noticed === null || raw === '') {
        warn.textContent = 'Ответьте на оба вопроса.';
        return;
      }
      var count = Math.max(0, Math.round(Number(raw) || 0));
      self.answer.count = count;
      self.showResults(count);
    });
  };

  GorillaDemo.prototype.showResults = function (count) {
    var self = this;
    var panel = this.panel;
    panel.innerHTML = '';

    panel.appendChild(node('p', 'demo-final-lead',
      'Светлая команда сделала передач: ' + this.lightPasses + '.'));

    if (this.gorillaSeen) {
      panel.appendChild(node('p', null, 'Через сцену прошла горилла — около пяти секунд.'));
    } else {
      panel.appendChild(node('p', null, 'Раунд закончился раньше, чем в сцене успела появиться горилла.'));
    }

    var delta = count - this.lightPasses;
    var deltaText = delta === 0 ? 'точно' : (delta > 0 ? 'лишних ' + delta : 'не хватает ' + (-delta));
    panel.appendChild(node('p', null, 'Ваш счёт: ' + count + ' (' + deltaText + ').'));

    panel.appendChild(node('p', null, this.answer.noticed
      ? 'Вы ответили, что необычное заметили. В исследовании 1999 года гориллу замечали 54% наблюдателей.'
      : 'Вы ответили, что необычного не заметили. В исследовании 1999 года гориллу не заметили 46% из 192 наблюдателей.'));

    if (this.gorillaSeen && !this.answer.noticed) {
      panel.appendChild(node('p', null,
        'Ни один из незаметивших не «вспомнил» гориллу, пока запись не прокрутили заново.'));
    }

    var actions = node('div', 'demo-row');
    var hintBtn = button('Повтор с подсказкой', 'btn btn-s');
    var againBtn = button('Заново', 'btn-ghost btn-s');
    actions.appendChild(hintBtn);
    actions.appendChild(againBtn);
    panel.appendChild(actions);

    this.on(hintBtn, 'click', function () { self.startRound(true); });
    this.on(againBtn, 'click', function () { self.startRound(false); });

    this.complete({
      demo: 'gorilla',
      passes: this.lightPasses,
      count: count,
      noticed: this.answer.noticed,
      gorilla: this.gorillaSeen,
      replay: this.hinted
    });
  };

  /* ======================= 4. netineti — «Нети нети» ======================= */

  var NETI = [
    { id: 'color', chip: 'Цвет', say: 'не это: цвет замечается — значит, он содержимое, а не замечающий.' },
    { id: 'sound', chip: 'Звук', say: 'не это: звук приходит и уходит, а замечание остаётся.' },
    { id: 'think', chip: 'Мысль', say: 'не это: мысль — гость, а не хозяин.' },
    { id: 'feel', chip: 'Эмоция', say: 'не это: состояние меняется, а то, чем оно замечено, — нет.' },
    { id: 'body', chip: 'Тело', say: 'не это: тело тоже видно — как и всё остальное.' },
    { id: 'self', chip: '«Я»', say: 'не это: «я» здесь — ещё одно представление, которое можно убрать.' },
    { id: 'world', chip: 'Мир', say: 'не это: мир — то, что предъявлено. Не то, чем предъявлено.' }
  ];

  function NetiDemo(host, opts) {
    Demo.call(this, 'netineti', host, opts);
    var self = this;

    this.alpha = {};      // текущая прозрачность слоёв сцены
    this.target = {};
    this.removed = {};
    NETI.forEach(function (l) { self.alpha[l.id] = 1; self.target[l.id] = 1; self.removed[l.id] = false; });
    this.t = 0;

    this.root.appendChild(node('p', 'demo-lead', 'Убирай по одному. После каждого остатка смотри, что осталось.'));
    this.root.appendChild(node('p', 'demo-hint', 'Это упрощённая форма практики «нети нети» — способ не добавлять знание, а отнимать всё переменное.'));

    this.chips = node('div', 'demo-chips');
    this.root.appendChild(this.chips);

    this.box = canvasBox(this, this.root, {
      aspect: 0.52, minHeight: 200,
      label: 'Полотно сцены: цвет, звук, мысль, эмоция, тело, «я» и мир'
    });
    this.box.onResize = function () { self.draw(); };

    this.log = node('ul', 'demo-log');
    this.root.appendChild(this.log);

    this.final = node('div', 'demo-final');
    this.final.hidden = true;
    var fin = node('p', null, 'Осталось то, чем всё это замечалось. Попробуй убрать и его — но чем ты это увидишь?');
    this.final.appendChild(fin);
    var finRow = node('div', 'demo-row');
    this.backBtn = button('Вернуть всё', 'btn-ghost btn-s');
    finRow.appendChild(this.backBtn);
    this.final.appendChild(finRow);
    this.root.appendChild(this.final);

    this.root.appendChild(node('p', 'demo-note',
      '«нети нети» — «не это, не это»: так в традиции описывают то, что описанию не поддаётся (Бр.-уп. 2.3.6: лучшего описания нет). Строки здесь — спокойный пересказ этого хода, не цитаты.'));

    this.chipEls = {};
    NETI.forEach(function (l) {
      var c = button(l.chip, 'demo-chip');
      c.setAttribute('aria-pressed', 'false');
      c.setAttribute('data-layer', l.id);
      c.style.borderColor = '';
      self.on(c, 'click', function () { self.remove(l.id); });
      self.chips.appendChild(c);
      self.chipEls[l.id] = c;
    });
    this.on(this.backBtn, 'click', function () { self.restore(); });

    this.loop(function (dt) { self.step(dt); });
    this.draw();
  }
  NetiDemo.prototype = Object.create(Demo.prototype);
  NetiDemo.prototype.constructor = NetiDemo;

  NetiDemo.prototype.remove = function (id) {
    if (this.removed[id]) return;
    this.removed[id] = true;
    this.target[id] = 0;
    var chip = this.chipEls[id];
    if (chip) {
      chip.setAttribute('aria-pressed', 'true');
      chip.disabled = true;
    }
    var def = null;
    NETI.forEach(function (l) { if (l.id === id) def = l; });
    if (def) {
      var li = node('li', 'demo-log-item');
      var b = node('b', null, def.chip);
      li.appendChild(b);
      li.appendChild(document.createTextNode(' — ' + def.say));
      this.log.appendChild(li);
    }
    var left = 0;
    var self = this;
    NETI.forEach(function (l) { if (!self.removed[l.id]) left++; });
    if (left === 0) {
      this.final.hidden = false;
      var names = NETI.map(function (l) { return l.chip; });
      this.complete({ demo: 'netineti', removed: names, remaining: [] });
    }
  };

  NetiDemo.prototype.restore = function () {
    var self = this;
    NETI.forEach(function (l) {
      self.removed[l.id] = false;
      self.target[l.id] = 1;
      var chip = self.chipEls[l.id];
      if (chip) { chip.setAttribute('aria-pressed', 'false'); chip.disabled = false; }
    });
    this.log.innerHTML = '';
    this.final.hidden = true;
  };

  NetiDemo.prototype.step = function (dt) {
    var self = this;
    this.t += dt;
    NETI.forEach(function (l) {
      var a = self.alpha[l.id];
      var a2 = self.target[l.id];
      self.alpha[l.id] = a + (a2 - a) * (1 - Math.exp(-dt / 0.7));
    });
    this.draw();
  };

  /* --- рисование сцены: семь слоёв, каждый со своей прозрачностью --- */

  function alphaOf(demo, id) {
    return clamp(demo.alpha[id] == null ? 0 : demo.alpha[id], 0, 1);
  }

  NetiDemo.prototype.draw = function () {
    var b = this.box, ctx = b.ctx, w = b.w, h = b.h;
    var cx = w / 2, cy = h * 0.62;
    var scale = clamp(Math.min(w, h) / 260, 0.75, 2);
    var t = this.t;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = token('bg2');
    ctx.fillRect(0, 0, w, h);

    // цвет — мягкие пятна по всему полотну
    var ac = alphaOf(this, 'color');
    if (ac > 0.01) {
      ctx.save();
      ctx.globalAlpha = ac * 0.5;
      var g1 = ctx.createRadialGradient(w * 0.28, h * 0.3, 4, w * 0.28, h * 0.3, w * 0.42);
      g1.addColorStop(0, token('water'));
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);
      var g2 = ctx.createRadialGradient(w * 0.74, h * 0.66, 4, w * 0.74, h * 0.66, w * 0.36);
      g2.addColorStop(0, token('accent'));
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // мир — линия горизонта и земля
    var aw = alphaOf(this, 'world');
    if (aw > 0.01) {
      ctx.save();
      ctx.globalAlpha = aw * 0.65;
      ctx.strokeStyle = 'rgba(233,229,218,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.06, cy + 46 * scale);
      ctx.lineTo(w * 0.94, cy + 46 * scale);
      ctx.stroke();
      ctx.fillStyle = 'rgba(233,229,218,.05)';
      ctx.fillRect(0, cy + 46 * scale, w, h - (cy + 46 * scale));
      ctx.restore();
    }

    // тело — простой силуэт
    var ab = alphaOf(this, 'body');
    if (ab > 0.01) {
      ctx.save();
      ctx.globalAlpha = ab * 0.9;
      ctx.strokeStyle = token('inkDim');
      ctx.lineWidth = 2;
      var bh = 40 * scale, bw = 22 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, cy + bh);      // корпус
      ctx.lineTo(cx - bw / 2, cy + 6 * scale);
      ctx.moveTo(cx + bw / 2, cy + bh);
      ctx.lineTo(cx + bw / 2, cy + 6 * scale);
      ctx.moveTo(cx - bw / 2, cy + bh);
      ctx.lineTo(cx + bw / 2, cy + bh);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 6 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // эмоция — тёплый круг, который дышит
    var af = alphaOf(this, 'feel');
    if (af > 0.01) {
      ctx.save();
      var pulse = 1 + Math.sin(t * 1.6) * 0.12;
      ctx.globalAlpha = af * (0.45 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.6)));
      var g3 = ctx.createRadialGradient(cx, cy + 14 * scale, 2, cx, cy + 14 * scale, 26 * scale * pulse);
      g3.addColorStop(0, token('warn'));
      g3.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g3;
      ctx.beginPath();
      ctx.arc(cx, cy + 14 * scale, 26 * scale * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // мысль — облачко точек над головой
    var at = alphaOf(this, 'think');
    if (at > 0.01) {
      ctx.save();
      ctx.globalAlpha = at * 0.75;
      ctx.fillStyle = token('inkDim');
      for (var i = 0; i < 4; i++) {
        var px = cx + 18 * scale + Math.cos(t * 0.6 + i * 1.7) * 12 * scale;
        var py = cy - 30 * scale + Math.sin(t * 0.5 + i * 2.1) * 8 * scale;
        ctx.beginPath();
        ctx.arc(px, py, (3.2 + i * 0.7) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // звук — расходящиеся дуги
    var as = alphaOf(this, 'sound');
    if (as > 0.01) {
      ctx.save();
      ctx.globalAlpha = as * 0.5;
      ctx.strokeStyle = token('water');
      ctx.lineWidth = 1.5;
      for (var k = 0; k < 3; k++) {
        var rr = (16 + k * 9 + ((t * 14) % 9)) * scale;
        ctx.globalAlpha = as * 0.45 * (1 - k * 0.25);
        ctx.beginPath();
        ctx.arc(cx - 26 * scale, cy - 6 * scale, rr, Math.PI * 0.62, Math.PI * 1.38);
        ctx.stroke();
      }
      ctx.restore();
    }

    // «я» — маленькая яркая точка с ореолом
    var aself = alphaOf(this, 'self');
    if (aself > 0.01) {
      ctx.save();
      ctx.globalAlpha = aself;
      var g4 = ctx.createRadialGradient(cx, cy - 6 * scale, 0, cx, cy - 6 * scale, 16 * scale);
      g4.addColorStop(0, token('accent'));
      g4.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g4;
      ctx.beginPath();
      ctx.arc(cx, cy - 6 * scale, 16 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy - 6 * scale, 2.6 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = aself * 0.9;
      ctx.fill();
      ctx.restore();
    }
  };

  /* ======================= 5. looking — «Посмотри на то, что смотрит» ======================= */

  var LOOK_LINES = ['Не ищи объект', 'Всё, что находится, — уже объект', 'Что не находится?'];

  function LookingDemo(host, opts) {
    Demo.call(this, 'looking', host, opts);
    var self = this;

    this.total = 90;
    this.phase = 'idle';    // idle → run → done
    this.left = this.total;
    this.elapsed = 0;
    this.lineIndex = -1;

    this.root.appendChild(node('p', 'demo-lead', 'Сядь удобно, не закрывай глаза. Ничего не ищи.'));
    this.root.appendChild(node('p', 'demo-hint', 'Девяносто секунд — просто смотри. Таймер идёт, пока демо на экране.'));

    this.stage = node('div', 'demo-stage');
    this.root.appendChild(this.stage);

    this.box = canvasBox(this, this.stage, {
      aspect: 0.46, minHeight: 200,
      label: 'Медленно пульсирующий круг'
    });
    this.box.onResize = function () { self.draw(); };

    this.line = node('div', 'demo-stage-line demo-fade', LOOK_LINES[0]);
    this.stage.appendChild(this.line);
    this.timer = node('div', 'demo-stage-timer', mmss(this.total));
    this.stage.appendChild(this.timer);

    var row = node('div', 'demo-row');
    this.startBtn = button('Начать 90 секунд', 'btn btn-s');
    this.stopBtn = button('Завершить раньше', 'btn-ghost btn-s');
    this.stopBtn.hidden = true;
    row.appendChild(this.startBtn);
    row.appendChild(this.stopBtn);
    this.root.appendChild(row);

    this.noteWrap = node('div', 'demo-note-wrap');
    this.noteWrap.hidden = true;
    this.ta = node('textarea', 'demo-textarea');
    this.ta.rows = 3;
    this.ta.placeholder = 'Одна-две строки: что осталось, когда ничего не искали.';
    this.ta.setAttribute('aria-label', 'Заметка после практики');
    this.noteWrap.appendChild(this.ta);
    var noteRow = node('div', 'demo-row');
    this.saveBtn = button('Сохранить в дневник', 'btn btn-s');
    this.skipNoteBtn = button('Готово без заметки', 'btn-ghost btn-s');
    this.againBtn = button('Начать заново', 'btn-ghost btn-s');
    this.againBtn.hidden = true;
    noteRow.appendChild(this.saveBtn);
    noteRow.appendChild(this.skipNoteBtn);
    noteRow.appendChild(this.againBtn);
    this.noteWrap.appendChild(noteRow);
    this.msg = node('p', 'demo-hint', 'Заметка хранится только в этом браузере — она уходит в дневник главы «Практика».');
    this.noteWrap.appendChild(this.msg);
    this.root.appendChild(this.noteWrap);

    this.on(this.startBtn, 'click', function () { self.start(); });
    this.on(this.stopBtn, 'click', function () { self.finish(); });
    this.on(this.saveBtn, 'click', function () { self.save(); });
    this.on(this.skipNoteBtn, 'click', function () {
      self.finishNote('');
      self.msg.textContent = 'Заметку не сохраняли.';
      self.complete({ demo: 'looking', seconds: Math.round(self.elapsed), note: '', saved: false });
    });
    this.on(this.againBtn, 'click', function () { self.resetLook(); });

    this.loop(function (dt) { self.step(dt); });
    this.draw();
  }
  LookingDemo.prototype = Object.create(Demo.prototype);
  LookingDemo.prototype.constructor = LookingDemo;

  LookingDemo.prototype.setLine = function (i) {
    if (i === this.lineIndex) return;
    this.lineIndex = i;
    fadeText(this, this.line, LOOK_LINES[clamp(i, 0, LOOK_LINES.length - 1)]);
  };

  LookingDemo.prototype.start = function () {
    this.phase = 'run';
    this.elapsed = 0;
    this.left = this.total;
    this.setLine(0);
    this.line.classList.add('on');
    this.startBtn.hidden = true;
    this.stopBtn.hidden = false;
    this.noteWrap.hidden = true;
    this.timer.textContent = mmss(this.total);
  };

  LookingDemo.prototype.step = function (dt) {
    if (this.phase !== 'run') return;   // вне сеанса кадры не нужны
    this.elapsed += dt;
    this.left = Math.max(0, this.total - this.elapsed);
    var i = Math.min(LOOK_LINES.length - 1, Math.floor(this.elapsed / (this.total / LOOK_LINES.length)));
    this.setLine(i);
    var txt = mmss(this.left);
    if (txt !== this._timerText) {
      this._timerText = txt;
      this.timer.textContent = txt;
    }
    if (this.left <= 0) { this.finish(); return; }
    this.draw();
  };

  LookingDemo.prototype.finish = function () {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.left = 0;
    this._timerText = mmss(0);
    this.timer.textContent = this._timerText;
    this.lineIndex = -1;
    fadeText(this, this.line, 'Время.');
    this.stopBtn.hidden = true;
    this.startBtn.hidden = true;
    this.noteWrap.hidden = false;
    this.againBtn.hidden = false;
    this.draw();
  };

  LookingDemo.prototype.finishNote = function (text) {
    this.saveBtn.hidden = true;
    this.skipNoteBtn.hidden = true;
    this.ta.disabled = true;
    if (text) this.ta.value = text;
    fadeText(this, this.line, 'Записанное останется в дневнике.');
    this.draw();
  };

  LookingDemo.prototype.save = function () {
    var text = this.ta.value.trim();
    if (!text) {
      this.msg.textContent = 'Пустую заметку не сохраняем.';
      return;
    }
    var prompt = 'Посмотри на то, что смотрит: 90 секунд';
    var saved = false;
    if (window.Practice && typeof window.Practice.addJournal === 'function') {
      try { window.Practice.addJournal(prompt, text); saved = true; }
      catch (e) { saved = false; }
    }
    this.msg.textContent = saved
      ? 'Сохранено в дневник.'
      : 'Дневник доступен в главе «Практика».';
    this.finishNote(text);
    this.complete({ demo: 'looking', seconds: Math.round(this.elapsed), note: text, saved: saved });
  };

  LookingDemo.prototype.resetLook = function () {
    this.phase = 'idle';
    this.elapsed = 0;
    this.left = this.total;
    this._timerText = mmss(this.total);
    this.timer.textContent = this._timerText;
    this.lineIndex = -1;
    this.line.classList.remove('on');
    this.line.textContent = '';
    this.ta.disabled = false;
    this.ta.value = '';
    this.noteWrap.hidden = true;
    this.saveBtn.hidden = false;
    this.skipNoteBtn.hidden = false;
    this.againBtn.hidden = true;
    this.startBtn.hidden = false;
    this.stopBtn.hidden = true;
    this.msg.textContent = 'Заметка хранится только в этом браузере — она уходит в дневник главы «Практика».';
    this.draw();
  };

  LookingDemo.prototype.draw = function () {
    var b = this.box, ctx = b.ctx, w = b.w, h = b.h;
    var cx = w / 2, cy = h / 2;
    var base = Math.min(w, h) * 0.26;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = token('bg2');
    ctx.fillRect(0, 0, w, h);

    var up = this.phase === 'run';
    var phase = up ? (this.elapsed % 8) / 8 : 0;                 // период ~8 с
    var k = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);          // 0 → 1 → 0
    var r = base * (0.86 + 0.28 * k);
    var alpha = up ? (0.16 + 0.28 * (1 - k)) : 0.18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = token('water');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // тихая точка в центре
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = token('accent');
    ctx.globalAlpha = up ? 0.7 : 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /* ======================= 6. contrast — «Нет фона — нет фигуры» ======================= */

  function ContrastDemo(host, opts) {
    Demo.call(this, 'contrast', host, opts);
    var self = this;

    this.value = 1;
    this.reported = false;

    this.root.appendChild(node('p', 'demo-lead', 'Фигура держится только на разнице с фоном. Уводи контраст к нулю.'));
    this.root.appendChild(node('p', 'demo-hint', 'Смотри на середину сцены: при нуле разницы фигуру не отличить от фона — и это не то же самое, что «её нет».'));

    this.box = canvasBox(this, this.root, {
      aspect: 0.5, minHeight: 200,
      label: 'Фигура на фоне; контраст управляется слайдером'
    });
    this.box.onResize = function () { self.draw(); };

    var row = node('div', 'demo-row');
    this.label = node('span', 'demo-label', '');
    this.slider = node('input', 'demo-slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.step = '1';
    this.slider.value = '100';
    this.slider.setAttribute('aria-label', 'Контраст фигуры и фона, проценты');
    row.appendChild(this.label);
    row.appendChild(this.slider);
    this.root.appendChild(row);

    this.state = node('p', 'demo-readout demo-fade', '');
    this.root.appendChild(this.state);

    this.root.appendChild(node('p', 'demo-note',
      'Информация — различие, которое создаёт различие (Бейтсон, 1972). Константа не несёт бит: у нулевой разницы нулевая разница.'));
    this.root.appendChild(node('p', 'demo-note',
      'Поэтому всеобщее невидимо не потому, что спрятано, а потому что не даёт дифференциальных следствий.'));

    this.on(this.slider, 'input', function () { self.update(); });

    this.update();
    this.draw();
  }
  ContrastDemo.prototype = Object.create(Demo.prototype);
  ContrastDemo.prototype.constructor = ContrastDemo;

  ContrastDemo.prototype.update = function () {
    this.value = clamp(Number(this.slider.value) / 100, 0, 1);
    var pct = Math.round(this.value * 100);
    this.label.textContent = 'Контраст: ' + pct + '%';
    var text = pct <= 2
      ? 'Различий нет: фигура совпала с фоном.'
      : (pct < 40
        ? 'Разница слабая: фигура угадывается с трудом.'
        : 'Фигура и фон различаются на ' + pct + '%.');
    fadeText(this, this.state, text);
    if (this.value <= 0.001 && !this.reported) {
      this.reported = true;
      this.complete({ demo: 'contrast', contrast: 0 });
    }
    this.draw();
  };

  ContrastDemo.prototype.draw = function () {
    var b = this.box, ctx = b.ctx, w = b.w, h = b.h;
    var bg = token('bg2');
    var t = this.value;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // мягкая тень по краям — фактура сцены
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2, cy = h / 2;
    var r = Math.min(w, h) * 0.3;

    ctx.fillStyle = mix(bg, token('water'), t);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = mix(bg, token('ink'), t);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = mix(bg, token('accent'), t);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  };

  /* ======================= 7. cut — «Разрез фон Неймана» ======================= */

  var CUT_NODES = ['атом', 'прибор', 'глаз', 'мозг', 'сознание', '?'];
  var CUT_WORDS = ['перед атомом', 'атом → прибор', 'прибор → глаз', 'глаз → мозг', 'мозг → сознание', 'сознание → ?', 'за «?»'];

  function CutDemo(host, opts) {
    Demo.call(this, 'cut', host, opts);
    var self = this;

    this.pos = 3;
    this.stops = [];

    this.root.appendChild(node('p', 'demo-lead', 'Где происходит «коллапс»? Проведи разрез по цепи и посмотри, что скажет физика.'));
    this.root.appendChild(node('p', 'demo-hint', 'Разрез можно поставить в любую точку цепи — вопрос в том, оставляет ли физика здесь выбор.'));

    this.frame = node('div', 'demo-cut-frame');
    this.track = node('div', 'demo-cut-track');
    this.nodeEls = [];
    CUT_NODES.forEach(function (label, i) {
      var n = node('span', 'demo-cut-node' + (label === '?' ? ' demo-cut-node-q' : ''), label);
      n.setAttribute('data-cut', label);
      self.track.appendChild(n);
      self.nodeEls.push(n);
      if (i < CUT_NODES.length - 1) self.track.appendChild(node('span', 'demo-cut-link'));
    });
    this.markEl = node('div', 'demo-cut-mark');
    this.track.appendChild(this.markEl);
    this.frame.appendChild(this.track);
    this.root.appendChild(this.frame);

    this.caption = node('p', 'demo-cut-caption demo-fade', '');
    this.root.appendChild(this.caption);

    this.final = node('div', 'demo-final');
    this.final.hidden = true;
    this.final.appendChild(node('p', 'demo-final-lead', 'Эксперимент не найдёт место разреза.'));
    this.final.appendChild(node('p', null,
      'Фон Нейман (1932): коллапс можно поместить в любое место цепи от прибора до «субъективного восприятия» — положение разреза задаёт не физика.'));
    this.root.appendChild(this.final);

    var row = node('div', 'demo-row');
    this.label = node('span', 'demo-label', '');
    this.slider = node('input', 'demo-slider');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = String(CUT_NODES.length);      // 0..6 — семь положений разреза
    this.slider.step = '1';
    this.slider.value = String(this.pos);
    this.slider.setAttribute('aria-label', 'Положение разреза на цепи');
    row.appendChild(this.label);
    row.appendChild(this.slider);
    this.root.appendChild(row);

    this.root.appendChild(node('p', 'demo-note',
      'Предохранитель от мистики: Вигнер — автор гипотезы «сознание вызывает коллапс» — сам от неё отказался (декогеренция, Це, 1970).'));

    this.on(this.slider, 'input', function () { self.place(Number(self.slider.value)); });

    if (window.ResizeObserver) {
      var ro = new window.ResizeObserver(function () { self.layout(); });
      ro.observe(this.frame);
      this._obs.push(ro);
    } else {
      this.on(window, 'resize', function () { self.layout(); });
    }

    this.layout();
  }
  CutDemo.prototype = Object.create(Demo.prototype);
  CutDemo.prototype.constructor = CutDemo;

  /* Границы между узлами — координаты возможных положений разреза. */
  CutDemo.prototype.layout = function () {
    var track = this.track;
    if (!track || !this.nodeEls.length) return;
    var tRect = track.getBoundingClientRect();
    if (!tRect.width) return;
    var boxes = this.nodeEls.map(function (n) { return n.getBoundingClientRect(); });
    var stops = [];
    stops.push(boxes[0].left - tRect.left - 1);
    for (var i = 1; i < boxes.length; i++) {
      stops.push((boxes[i - 1].right + boxes[i].left) / 2 - tRect.left);
    }
    stops.push(boxes[boxes.length - 1].right - tRect.left + 1);
    this.stops = stops;
    this.place(clamp(this.pos, 0, stops.length - 1), true);
  };

  CutDemo.prototype.place = function (pos, force) {
    if (!this.stops.length) return;
    this.pos = clamp(pos, 0, this.stops.length - 1);
    if (!force) this.slider.value = String(this.pos);

    var x = this.stops[this.pos];
    this.markEl.style.left = (x - 1) + 'px';

    var self = this;
    this.nodeEls.forEach(function (n, i) {
      var near = (self.pos === 0 && i === 0) ||
        (self.pos === self.stops.length - 1 && i === self.nodeEls.length - 1) ||
        (i === self.pos - 1) || (i === self.pos);
      n.classList.toggle('on', near);
    });

    this.label.textContent = 'Разрез: ' + CUT_WORDS[this.pos];

    var text = this.pos >= 6
      ? 'физика не указывает место — разрез задаём мы'
      : (this.pos === 5 ? 'или здесь?' : 'здесь?');
    fadeText(this, this.caption, text);
    this.final.hidden = this.pos < 6;

    // держим разрез в видимой части прокручиваемой цепи
    var frame = this.frame;
    if (frame && frame.scrollWidth > frame.clientWidth + 2) {
      if (x < frame.scrollLeft + 24 || x > frame.scrollLeft + frame.clientWidth - 24) {
        frame.scrollLeft = clamp(x - frame.clientWidth / 2, 0, frame.scrollWidth - frame.clientWidth);
      }
    }
  };

  /* ======================= реестр ======================= */

  var DEFS = {
    troxler: { title: 'Гаснущие пятна', make: TroxlerDemo },
    blindspot: { title: 'Найди своё слепое пятно', make: BlindSpotDemo },
    gorilla: { title: 'Горилла', make: GorillaDemo },
    netineti: { title: 'Нети нети', make: NetiDemo },
    looking: { title: 'Посмотри на то, что смотрит', make: LookingDemo },
    contrast: { title: 'Нет фона — нет фигуры', make: ContrastDemo },
    cut: { title: 'Разрез фон Неймана', make: CutDemo }
  };

  var items = {};
  Object.keys(DEFS).forEach(function (id) {
    items[id] = {
      id: id,
      title: DEFS[id].title,
      mount: function (el, opts) { return api.mount(id, el, opts); }
    };
  });

  var api = {
    version: '0.1',
    items: items,

    has: function (id) { return !!this.items[id]; },

    /* Чистит el (или его .demo-body, если он есть) и создаёт новый экземпляр. */
    mount: function (id, el, opts) {
      var def = DEFS[id];
      if (!def || !el || !el.nodeType) return null;
      var target = (el.querySelector && el.querySelector('.demo-body')) || el;
      var prev = target.__demo;
      if (prev && typeof prev.destroy === 'function') prev.destroy();
      target.innerHTML = '';
      var inst = null;
      try {
        inst = new def.make(target, opts || {});
      } catch (err) {
        if (window.console && console.error) console.error('Demos.mount(' + id + '):', err);
        return null;
      }
      target.__demo = inst;
      return inst;
    },

    /* Список id — удобно для тестовой страницы. */
    list: function () { return Object.keys(items); },

    destroy: function (el) {
      if (!el || !el.__demo) return false;
      el.__demo.destroy();
      return true;
    }
  };

  window.Demos = api;
})(window, document);
