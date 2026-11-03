/*
 * script.js - the INTERFACE logic of the calculator
 * ---------------------------------------------------------------------------
 * This file connects the buttons on the page to the math engine (engine.js).
 *
 * How it works, in plain words:
 *   1. The calculator remembers what you typed in one text variable: state.expr
 *   2. Every button press changes state.expr (adds a digit, an operator ...).
 *   3. After every press, render() redraws the display from state.
 *   4. When you press "=", state.expr is given to CalcEngine.evaluate().
 *      The engine returns either a number or an error message.
 *
 * Sections:
 *   A. Settings and saved data      D. Keyboard support
 *   B. Typing functions             E. History panel
 *   C. Display (render)             F. Start-up
 */
(function () {
  'use strict';

  const Engine = window.CalcEngine;
  const $ = (id) => document.getElementById(id);

  const calcEl = $('calc');
  const mainEl = $('main');
  const subEl = $('sub');
  const screenEl = $('screen');
  const memBadge = $('memBadge');
  const toastEl = $('toast');
  const historyEl = $('history');
  const historyList = $('historyList');

  if (!Engine) {
    mainEl.textContent = 'engine.js missing';
    return;
  }

  /* =========================================================================
   * A. SETTINGS AND SAVED DATA
   * ========================================================================= */

  const MAX_HISTORY = 50;
  const OPERATORS = '+-−×÷*/^';
  // true when the text ends with something that is a "value" (number, ), π, e, Ans, !, %, ...)
  const ENDS_WITH_VALUE = /(?:[0-9.)πe²³!%°]|Ans)$/;

  // Saved settings (theme, angle mode, memory, history) are kept in the browser.
  // Every access is wrapped in try/catch because browsers can block storage.
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('nexus.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('nexus.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  const savedHistory = store.get('history', []);
  const savedMemory = store.get('memory', 0);
  const savedAngle = store.get('angle', 'DEG');

  const state = {
    expr: '',                 // what the user typed, e.g. "2×(3+4"
    justEvaluated: false,     // true right after pressing "="
    result: null,             // result text shown after "="
    lastExpr: '',             // the expression that produced the result
    ans: 0,                   // previous answer (the Ans key)
    error: '',                // error message, '' when there is none
    signParen: false,         // true while a "(−5" created by the +/− key is still open
    angle: savedAngle === 'RAD' ? 'RAD' : 'DEG',
    memory: Number.isFinite(savedMemory) ? savedMemory : 0,
    history: Array.isArray(savedHistory)
      ? savedHistory.filter(function (h) {
          return h && typeof h.expr === 'string' && typeof h.result === 'string' && Number.isFinite(h.value);
        }).slice(0, MAX_HISTORY)
      : []
  };

  /* =========================================================================
   * Small helpers
   * ========================================================================= */

  // Make text look nice on screen: - * / become − × ÷
  function pretty(text) {
    return String(text).replace(/-/g, '−').replace(/\*/g, '×').replace(/\//g, '÷');
  }

  function isOperator(ch) {
    return ch.length === 1 && OPERATORS.indexOf(ch) !== -1;
  }

  function calc(expression) {
    return Engine.evaluate(expression, { angleMode: state.angle, ans: state.ans });
  }

  // Add any missing ")" at the end, so history shows the full expression.
  function withClosedBrackets(text) {
    const open = (text.match(/\(/g) || []).length - (text.match(/\)/g) || []).length;
    return open > 0 ? text + ')'.repeat(open) : text;
  }

  let toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

  /* =========================================================================
   * B. TYPING FUNCTIONS (each one changes state.expr)
   * ========================================================================= */

  // After a result, typing a NEW number / function starts a fresh calculation.
  function startFresh() {
    if (state.justEvaluated) {
      state.expr = '';
      state.justEvaluated = false;
      state.result = null;
    }
  }

  // After a result, typing an operator CONTINUES with the result (5+5=10, then ×2).
  function continueWithAnswer() {
    if (state.justEvaluated) {
      state.expr = Engine.toInputString(state.ans);
      state.justEvaluated = false;
      state.result = null;
    }
  }

  // The +/− key writes "(−5". Before the next operator we close that bracket.
  function closeSignParen() {
    if (state.signParen && /\(−[0-9.]+$/.test(state.expr)) state.expr += ')';
    state.signParen = false;
  }

  function inputDigit(digit) {
    state.error = '';
    startFresh();
    // replace a lone leading zero:  0 then 5 -> 5   (but keep 0.5 and 10)
    if (/(^|[^0-9.])0$/.test(state.expr)) {
      if (digit === '0') return;
      state.expr = state.expr.slice(0, -1) + digit;
      return;
    }
    state.expr += digit;
  }

  function inputDecimal() {
    state.error = '';
    startFresh();
    const segment = /[0-9.]*$/.exec(state.expr)[0];
    if (segment.indexOf('.') !== -1) return;          // already has a dot
    state.expr += segment === '' ? '0.' : '.';
  }

  function inputOperator(op) {
    state.error = '';
    continueWithAnswer();
    closeSignParen();
    const text = state.expr;

    if (text.slice(-5) === ' mod ') {                  // replace "mod" by the new operator
      state.expr = text.slice(0, -5) + op;
      return;
    }
    if (text === '') {                                 // empty: "−" = negative, others use Ans
      state.expr = op === '−' ? '−' : 'Ans' + op;
      return;
    }
    const last = text.slice(-1);
    if (isOperator(last)) {
      if (op === '−' && '×÷*/^'.indexOf(last) !== -1) {  // allow 5×−3
        state.expr = text + op;
        return;
      }
      const stripped = text.replace(/[+\-−×÷*\/^]+$/, ''); // otherwise replace the old operator
      state.expr = stripped === '' ? (op === '−' ? '−' : 'Ans' + op) : stripped + op;
      return;
    }
    if (last === '(') {                                // after "(" only + or − make sense
      if (op === '−' || op === '+') state.expr = text + op;
      return;
    }
    state.expr = text + op;
  }

  // functions, constants, "(" : sin( cos( √( π e Ans ...
  function inputText(text) {
    state.error = '';
    if (text === ')') { closeBracket(); return; }
    startFresh();
    state.signParen = false;
    state.expr += text;
  }

  function closeBracket() {
    if (state.justEvaluated) return;
    const text = state.expr;
    const open = (text.match(/\(/g) || []).length - (text.match(/\)/g) || []).length;
    if (open <= 0) return;                             // nothing to close
    const last = text.slice(-1);
    if (last === '(' || isOperator(last)) return;      // "()" or "+)" is not valid
    state.expr = text + ')';
    state.signParen = false;
  }

  // symbols written AFTER a value:  x²  x³  n!  %  °
  function inputPostfix(symbol) {
    state.error = '';
    continueWithAnswer();
    if (state.expr === '') return;
    closeSignParen();
    if (!ENDS_WITH_VALUE.test(state.expr)) return;
    state.expr += symbol;
  }

  function inputMod() {
    state.error = '';
    continueWithAnswer();
    if (state.expr === '') return;
    closeSignParen();
    if (!ENDS_WITH_VALUE.test(state.expr)) return;
    state.expr += ' mod ';
  }

  function toggleSign() {
    state.error = '';
    if (state.justEvaluated) {                         // negate the result and keep editing
      state.expr = Engine.toInputString(-state.ans);
      state.justEvaluated = false;
      state.result = null;
      state.signParen = false;
      return;
    }
    const text = state.expr;
    if (text === '') { state.expr = '−'; return; }
    if (text === '−') { state.expr = ''; return; }
    const negative = /\(([−-])([0-9.]+)$/.exec(text);  // "(−5" -> "5"
    if (negative) {
      state.expr = text.slice(0, negative.index) + negative[2];
      state.signParen = false;
      return;
    }
    const number = /[0-9.]+$/.exec(text);              // "5" -> "(−5"
    if (number) {
      state.expr = text.slice(0, number.index) + '(−' + number[0];
      state.signParen = true;
      return;
    }
    const last = text.slice(-1);
    if (isOperator(last) || last === '(') {
      state.expr = text + '(−';
      state.signParen = true;
    }
  }

  function deleteLast() {
    state.error = '';
    if (state.justEvaluated) {                         // DEL after a result clears it
      state.expr = '';
      state.justEvaluated = false;
      state.result = null;
      return;
    }
    state.signParen = false;
    // remove a whole function name ("sin(") or "Ans" or " mod " in one press
    state.expr = state.expr.replace(
      /(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|recip\(|exp\(|abs\(|ln\(|log\(|√\(|∛\(| mod |Ans|[\s\S])$/, '');
  }

  function clearAll() {
    state.expr = '';
    state.result = null;
    state.lastExpr = '';
    state.justEvaluated = false;
    state.error = '';
    state.signParen = false;
  }

  function calculate() {
    if (state.justEvaluated || state.expr === '') return;
    const result = calc(state.expr);
    if (!result.ok) {
      state.error = result.error;
      screenEl.classList.remove('shake');
      void screenEl.offsetWidth;                       // restart the shake animation
      screenEl.classList.add('shake');
      return;
    }
    const shownExpression = pretty(withClosedBrackets(state.expr));
    state.history.unshift({ expr: shownExpression, result: result.text, value: result.value, mode: state.angle });
    if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
    store.set('history', state.history);

    state.ans = result.value;
    state.result = result.text;
    state.lastExpr = shownExpression;
    state.justEvaluated = true;
    state.error = '';
    state.signParen = false;
  }

  /* ---- memory ---- */
  function currentValue() {
    if (state.justEvaluated) return { ok: true, value: state.ans };
    if (state.expr === '') return { ok: false, error: 'Enter a number first' };
    return calc(state.expr);
  }

  function memoryChange(direction) {                   // +1 for M+, -1 for M−
    const current = currentValue();
    if (!current.ok) { state.error = current.error; return; }
    const total = Number((state.memory + direction * current.value).toPrecision(12));
    if (!Number.isFinite(total)) { state.error = 'Memory overflow'; return; }
    state.memory = total;
    store.set('memory', total);
    toast('Memory = ' + pretty(Engine.formatNumber(total)));
  }

  function memoryRecall() {
    state.error = '';
    startFresh();
    state.signParen = false;
    // MR replaces the number you are typing, otherwise it is added at the end
    state.expr = state.expr.replace(/[0-9.]+$/, '') + Engine.toInputString(state.memory);
  }

  function memoryClear() {
    state.memory = 0;
    store.set('memory', 0);
    toast('Memory cleared');
  }

  /* ---- angle mode and theme ---- */
  function setAngle(mode) {
    state.angle = mode === 'RAD' ? 'RAD' : 'DEG';
    store.set('angle', state.angle);
    state.error = '';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const toLight = theme === 'dark';
    $('themeBtn').setAttribute('aria-label', toLight ? 'Switch to light theme' : 'Switch to dark theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', toLight ? '#0d1321' : '#eaf0f9');
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    store.set('theme', next);
  }

  function setSciOpen(open) {
    calcEl.classList.toggle('show-sci', open);
    $('sciBtn').setAttribute('aria-expanded', String(open));
    $('sciBtn').setAttribute('aria-label', open ? 'Hide scientific keys' : 'Show scientific keys');
    store.set('sci', open);
  }

  /* ---- copy ---- */
  function copyResult() {
    let text = null;
    if (state.justEvaluated) {
      text = state.result;
    } else if (state.expr !== '') {
      const r = calc(state.expr);
      if (r.ok) text = r.text;
    }
    if (text === null) { toast('Nothing to copy'); return; }

    const done = function () { toast('Copied: ' + pretty(text)); };
    const fallback = function () {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
      document.body.removeChild(box);
      if (copied) done(); else toast('Copy not allowed here');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /* =========================================================================
   * C. DISPLAY
   * ========================================================================= */

  // Make long numbers smaller so they fit; very long text scrolls instead.
  function fitText() {
    mainEl.style.fontSize = '';
    let size = parseFloat(getComputedStyle(mainEl).fontSize);
    while (mainEl.scrollWidth > mainEl.clientWidth && size > 18) {
      size -= 2;
      mainEl.style.fontSize = size + 'px';
    }
    mainEl.scrollLeft = mainEl.scrollWidth;
  }

  function render() {
    // big line
    const showResult = state.justEvaluated;
    mainEl.textContent = showResult ? pretty(state.result) : (state.expr !== '' ? pretty(state.expr) : '0');

    // small line: error, "expr =", or a live preview
    let sub = '';
    let isError = false;
    if (state.error) {
      sub = state.error;
      isError = true;
    } else if (showResult) {
      sub = state.lastExpr + ' =';
    } else if (state.expr !== '') {
      const preview = calc(state.expr);
      if (preview.ok && pretty(preview.text) !== pretty(state.expr)) sub = '= ' + pretty(preview.text);
    }
    subEl.textContent = sub;
    subEl.classList.toggle('error', isError);

    // angle mode buttons
    document.querySelectorAll('[data-angle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.angle === state.angle));
    });

    // memory badge
    memBadge.hidden = state.memory === 0;
    memBadge.title = 'Memory: ' + pretty(Engine.formatNumber(state.memory));

    fitText();
  }

  /* =========================================================================
   * BUTTON CLICKS  (one listener for the whole calculator)
   * ========================================================================= */

  calcEl.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button || !calcEl.contains(button)) return;
    const d = button.dataset;

    if (d.digit !== undefined) inputDigit(d.digit);
    else if (d.op !== undefined) inputOperator(d.op);
    else if (d.insert !== undefined) inputText(d.insert);
    else if (d.post !== undefined) inputPostfix(d.post);
    else if (d.angle !== undefined) setAngle(d.angle);
    else if (d.action !== undefined) {
      switch (d.action) {
        case 'clear': clearAll(); break;
        case 'delete': deleteLast(); break;
        case 'calculate': calculate(); break;
        case 'sign': toggleSign(); break;
        case 'decimal': inputDecimal(); break;
        case 'mod': inputMod(); break;
        case 'mc': memoryClear(); break;
        case 'mr': memoryRecall(); break;
        case 'mplus': memoryChange(1); break;
        case 'mminus': memoryChange(-1); break;
        default: break;
      }
    } else {
      return;   // theme / history / copy buttons have their own listeners below
    }
    render();
  });

  $('themeBtn').addEventListener('click', toggleTheme);
  $('sciBtn').addEventListener('click', function () { setSciOpen(!calcEl.classList.contains('show-sci')); });
  $('copyBtn').addEventListener('click', copyResult);

  /* =========================================================================
   * D. KEYBOARD SUPPORT
   * Each keyboard key "presses" the matching on-screen button.
   * ========================================================================= */

  const KEYMAP = {
    '+': '[data-op="+"]', '-': '[data-op="−"]', '*': '[data-op="×"]', 'x': '[data-op="×"]',
    '/': '[data-op="÷"]', '^': '[data-op="^"]',
    '(': '[data-insert="("]', ')': '[data-insert=")"]',
    '.': '[data-action="decimal"]', ',': '[data-action="decimal"]',
    '!': '[data-post="!"]', '%': '[data-post="%"]',
    'Enter': '[data-action="calculate"]', '=': '[data-action="calculate"]',
    'Backspace': '[data-action="delete"]',
    'Delete': '[data-action="clear"]',
    's': '[data-insert="sin("]', 'c': '[data-insert="cos("]', 't': '[data-insert="tan("]',
    'r': '[data-insert="√("]', 'l': '[data-insert="ln("]', 'g': '[data-insert="log("]',
    'p': '[data-insert="π"]', 'e': '[data-insert="e"]', 'a': '[data-insert="Ans"]',
    'm': '[data-action="mod"]'
  };

  function pressButton(selector) {
    const button = calcEl.querySelector(selector);
    if (!button) return;
    button.classList.add('pressed');
    setTimeout(function () { button.classList.remove('pressed'); }, 110);
    button.click();
  }

  document.addEventListener('keydown', function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;   // keep Ctrl+C, Ctrl+R ... working
    const key = event.key;

    if (historyEl.classList.contains('open')) {                   // history panel is open
      if (key === 'Escape') { closeHistory(); event.preventDefault(); }
      return;
    }
    if (key === 'Escape') { pressButton('[data-action="clear"]'); event.preventDefault(); return; }
    if (key === 'h' || key === 'H') { openHistory(); event.preventDefault(); return; }
    if (key === 'd' || key === 'D') { setAngle(state.angle === 'DEG' ? 'RAD' : 'DEG'); render(); event.preventDefault(); return; }

    if (/^[0-9]$/.test(key)) {
      pressButton('[data-digit="' + key + '"]');
      event.preventDefault();
      return;
    }
    const selector = KEYMAP[key] || KEYMAP[key.toLowerCase()];
    if (selector && key.length >= 1) {
      pressButton(selector);
      event.preventDefault();          // also stops Enter from re-clicking a focused button
    }
  });

  /* =========================================================================
   * E. HISTORY PANEL
   * ========================================================================= */

  function renderHistory() {
    historyList.textContent = '';
    if (state.history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No calculations yet.';
      historyList.appendChild(empty);
      return;
    }
    state.history.forEach(function (item, index) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'h-item';
      row.dataset.index = String(index);
      const expr = document.createElement('span');
      expr.className = 'h-expr';
      expr.textContent = item.expr + ' =';
      const res = document.createElement('span');
      res.className = 'h-res';
      res.textContent = pretty(item.result);
      row.appendChild(expr);
      row.appendChild(res);
      historyList.appendChild(row);
    });
  }

  function setCovered(isCovered) {                     // stop Tab from reaching hidden controls
    Array.prototype.forEach.call(calcEl.children, function (child) {
      if (child !== historyEl && child !== toastEl) child.inert = isCovered;
    });
  }

  function openHistory() {
    renderHistory();
    setCovered(true);
    historyEl.inert = false;
    historyEl.setAttribute('aria-hidden', 'false');
    historyEl.classList.add('open');
    $('historyClose').focus();
  }

  function closeHistory() {
    historyEl.classList.remove('open');
    historyEl.setAttribute('aria-hidden', 'true');
    historyEl.inert = true;
    setCovered(false);
    $('historyBtn').focus();
  }

  $('historyBtn').addEventListener('click', openHistory);
  $('historyClose').addEventListener('click', closeHistory);
  $('historyClear').addEventListener('click', function () {
    state.history = [];
    store.set('history', []);
    renderHistory();
  });
  historyList.addEventListener('click', function (event) {
    const row = event.target.closest('.h-item');
    if (!row) return;
    const item = state.history[Number(row.dataset.index)];
    if (!item) return;
    // reuse the answer: it becomes the number you are typing
    state.expr = Engine.toInputString(item.value);
    state.justEvaluated = false;
    state.result = null;
    state.error = '';
    state.signParen = false;
    closeHistory();
    render();
  });

  /* =========================================================================
   * F. START-UP
   * ========================================================================= */

  applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  setSciOpen(store.get('sci', false) === true);
  render();
  window.addEventListener('resize', fitText);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);
})();
