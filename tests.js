/*
 * tests.js - automatic tests for the math engine
 * ---------------------------------------------------------------------------
 * Run in a terminal (inside the scientific-calculator folder):
 *
 *     node tests.js
 *
 * Or open tests.html in your browser to see the same results on a web page.
 *
 * Every line below is one test:
 *   ok('expression', expectedNumber, 'DEG' or 'RAD')   -> must calculate to that number
 *   bad('expression', 'DEG' or 'RAD')                  -> must be rejected with an error
 */
(function () {
  'use strict';

  const isNode = typeof module === 'object' && module.exports;
  const Engine = isNode ? require('./engine.js') : window.CalcEngine;

  const cases = [];
  const ok = function (expr, expected, mode, options) {
    cases.push({ expr: expr, expected: expected, mode: mode || 'DEG', options: options || {} });
  };
  const bad = function (expr, mode) {
    cases.push({ expr: expr, expected: 'ERROR', mode: mode || 'DEG', options: {} });
  };
  // same test in both angle modes
  const both = function (expr, expected) { ok(expr, expected, 'DEG'); ok(expr, expected, 'RAD'); };
  const bothBad = function (expr) { bad(expr, 'DEG'); bad(expr, 'RAD'); };

  /* ---- 1. The table from the project brief (DEG and RAD) ---- */
  both('5 + 5', 10);
  both('10 − 4', 6);
  both('5 × 5', 25);
  both('20 ÷ 4', 5);
  both('2²', 4);
  both('√81', 9);
  both('2³', 8);
  both('log(100)', 2);
  both('ln(e)', 1);
  both('sin(30°)', 0.5);
  both('cos(60°)', 0.5);
  both('tan(45°)', 1);
  both('5!', 120);
  both('2 × (3 + 4)', 14);

  /* ---- 2. Order of operations ---- */
  both('2 + 3 × 4', 14);
  both('(2 + 3) × 4', 20);
  both('10 − 2 − 3', 5);
  both('100 ÷ 10 ÷ 5', 2);
  both('2 × 3^2', 18);
  both('2^3^2', 512);
  both('-2^2', -4);
  both('(-2)^2', 4);
  both('2^-1', 0.5);
  both('-(3 + 4)', -7);
  both('--5', 5);
  both('5 - -3', 8);
  both('5 × -3', -15);
  both('+5', 5);
  both('2 × (3 + (4 − 1)) ÷ 3', 4);
  both('1 ÷ 3 × 3', 1);

  /* ---- 3. Decimals, percent, constants ---- */
  both('0.1 + 0.2', 0.3);
  both('1.5 × 2', 3);
  both('.5 + .5', 1);
  both('7.', 7);
  both('50%', 0.5);
  both('200 × 10%', 20);
  both('π', Math.PI);
  both('2π', 2 * Math.PI);
  both('e', Math.E);
  both('2e', 2 * Math.E);
  both('e^2', Math.E * Math.E);
  both('e^(1)', Math.E);

  /* ---- 4. Scientific functions ---- */
  both('√(144)', 12);
  both('sqrt(2)', Math.SQRT2);
  both('∛27', 3);
  both('∛(-8)', -2);
  both('abs(-5)', 5);
  both('abs(5)', 5);
  both('10^3', 1000);
  both('10^(-2)', 0.01);
  both('1÷(4)', 0.25);
  both('recip(4)', 0.25);
  both('exp(1)', Math.E);
  both('ln(1)', 0);
  both('log(1000)', 3);
  both('log(0.001)', -3);
  both('0!', 1);
  both('10!', 3628800);
  both('3!+2', 8);
  both('2^3!', 64);
  both('(2+1)!', 6);
  both('-3!', -6);
  both('3!!', 720);
  both('170!', 7.257415615307994e306);
  both('0^0', 1);
  both('2^0.5', Math.SQRT2);

  /* ---- 5. Implicit multiplication, mod, Ans ---- */
  both('2(3 + 4)', 14);
  both('(1+1)(2+2)', 8);
  both('7 mod 3', 1);
  both('-7 mod 3', 2);
  both('5.5 mod 2', 1.5);
  ok('Ans + 1', 42, 'DEG', { ans: 41 });
  ok('Ans × 2', 5, 'RAD', { ans: 2.5 });
  both('Ans', 0);

  /* ---- 6. Trigonometry in DEG mode ---- */
  ok('sin(30)', 0.5, 'DEG');
  ok('cos(60)', 0.5, 'DEG');
  ok('tan(45)', 1, 'DEG');
  ok('sin(90)', 1, 'DEG');
  ok('cos(90)', 0, 'DEG');
  ok('sin(180)', 0, 'DEG');
  ok('cos(180)', -1, 'DEG');
  ok('sin(270)', -1, 'DEG');
  ok('sin(360)', 0, 'DEG');
  ok('sin(-30)', -0.5, 'DEG');
  ok('tan(135)', -1, 'DEG');
  ok('tan(180)', 0, 'DEG');
  ok('3sin(30)', 1.5, 'DEG');
  ok('asin(0.5)', 30, 'DEG');
  ok('acos(0.5)', 60, 'DEG');
  ok('atan(1)', 45, 'DEG');
  ok('asin(1)', 90, 'DEG');
  bad('tan(90)', 'DEG');
  bad('tan(270)', 'DEG');
  bad('asin(2)', 'DEG');
  bad('acos(-2)', 'DEG');

  /* ---- 7. Trigonometry in RAD mode ---- */
  ok('sin(π/2)', 1, 'RAD');
  ok('cos(π)', -1, 'RAD');
  ok('sin(π)', 0, 'RAD');
  ok('cos(π/2)', 0, 'RAD');
  ok('tan(π/4)', 1, 'RAD');
  ok('sin(30)', -0.988031624092862, 'RAD');
  ok('asin(1)', Math.PI / 2, 'RAD');
  ok('acos(-1)', Math.PI, 'RAD');
  ok('atan(1)', Math.PI / 4, 'RAD');
  ok('tan(90)', -1.995200412208242, 'RAD');
  bad('tan(π/2)', 'RAD');
  bad('asin(2)', 'RAD');

  /* ---- 8. Things that MUST be rejected (no crashes) ---- */
  bothBad('1 ÷ 0');
  bothBad('0 ÷ 0');
  bothBad('5 ÷ (3 − 3)');
  bothBad('√(-4)');
  bothBad('ln(0)');
  bothBad('ln(-1)');
  bothBad('log(0)');
  bothBad('log(-5)');
  bothBad('(-1)!');
  bothBad('2.5!');
  bothBad('171!');
  bothBad('0^-1');
  bothBad('(-8)^(1/3)');
  bothBad('10^400');
  bothBad('exp(1000)');
  bothBad('recip(0)');
  bothBad('7 mod 0');
  bothBad('9'.repeat(400));

  /* ---- 9. Bad syntax and unsafe input ---- */
  bothBad('');
  bothBad('   ');
  bothBad('2 +');
  bothBad('2 + × 3');
  bothBad('× 3');
  bothBad('()');
  bothBad(')');
  bothBad('(2 + 3))');
  bothBad('sin()');
  bothBad('sin(');
  bothBad('sin');
  bothBad('2 3');
  bothBad('1.2.3');
  bothBad('!');
  bothBad('%');
  bothBad('abc');
  bothBad('alert(1)');
  bothBad('process.exit()');
  bothBad('1;2');
  bothBad('2 $ 3');
  bothBad('__proto__');
  bothBad('constructor');
  bothBad('("a")');
  bothBad('('.repeat(200) + '1');
  bothBad('-'.repeat(200) + '1');
  bothBad('1+'.repeat(300) + '1');

  /* ---- 10. Missing closing brackets are closed automatically ---- */
  both('(2 + 3', 5);
  both('2 × (3 + (4', 14);
  ok('sin(30', 0.5, 'DEG');

  /* ---- Number formatting tests ---- */
  const formatCases = [
    [0.1 + 0.2, '0.3'],
    [1 / 3, '0.333333333333'],
    [2.5, '2.5'],
    [-1234.5678, '-1234.5678'],
    [123456789012, '123456789012'],
    [1e12, '1e+12'],
    [1.5e20, '1.5e+20'],
    [-2.5e25, '-2.5e+25'],
    [0.000001, '0.000001'],
    [1e-7, '1e-7'],
    [2.5e-9, '2.5e-9'],
    [-0, '0']
  ];
  const inputCases = [
    [7, '7'],
    [-5, '(-5)'],
    [1.5e20, '(1.5×10^20)'],
    [2.5e-9, '(2.5×10^-9)']
  ];

  /* ---- Run everything ---- */
  const lines = [];
  let passed = 0;
  let failed = 0;

  function record(isPass, text) {
    if (isPass) passed++; else failed++;
    lines.push((isPass ? 'PASS  ' : 'FAIL  ') + text);
  }

  function close(a, b) {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  }

  cases.forEach(function (c) {
    const r = Engine.evaluate(c.expr, { angleMode: c.mode, ans: c.options.ans });
    const label = '[' + c.mode + '] ' + JSON.stringify(c.expr.length > 40 ? c.expr.slice(0, 37) + '...' : c.expr);
    if (c.expected === 'ERROR') {
      record(!r.ok, label + ' -> expected an error, got ' + (r.ok ? r.text : 'error: ' + r.error));
    } else {
      record(r.ok && close(r.value, c.expected),
        label + ' -> expected ' + c.expected + ', got ' + (r.ok ? r.value : 'error: ' + r.error));
    }
  });

  formatCases.forEach(function (c) {
    const got = Engine.formatNumber(c[0]);
    record(got === c[1], '[format] formatNumber(' + c[0] + ') -> expected "' + c[1] + '", got "' + got + '"');
  });
  inputCases.forEach(function (c) {
    const got = Engine.toInputString(c[0]);
    record(got === c[1], '[input ] toInputString(' + c[0] + ') -> expected "' + c[1] + '", got "' + got + '"');
  });

  // The engine must keep working after errors (no crashes, no leftover state).
  const again = Engine.evaluate('2 + 2', { angleMode: 'DEG' });
  record(again.ok && again.value === 4, '[state ] engine still works after errors -> 2 + 2 = ' + again.value);

  const summary = '\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' tests in total.';

  if (isNode) {
    console.log(lines.join('\n') + summary);
    if (failed > 0) process.exitCode = 1;
  } else {
    const out = document.getElementById('out');
    out.textContent = lines.join('\n') + summary;
    document.title = (failed ? 'FAIL' : 'PASS') + ' - ' + passed + '/' + (passed + failed);
  }
})();
