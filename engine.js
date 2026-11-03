/*
 * engine.js - the MATH ENGINE of the Scientific Calculator
 * ---------------------------------------------------------------------------
 * This file turns text such as "2 × (3 + 4)" into a number WITHOUT using
 * JavaScript's eval(). It works in three steps:
 *
 *   1. TOKENIZER  - cuts the text into small pieces (numbers, operators, names).
 *   2. PARSER     - reads the pieces in the correct order of operations
 *                   (brackets, powers, × ÷, then + −) and calculates as it goes.
 *   3. FORMATTER  - turns the final number into clean text (12 digits,
 *                   scientific notation for very large / very small values).
 *
 * Because the engine only understands the symbols listed below, any other text
 * (for example "alert(1)") is rejected with an error message. That is what
 * makes it safe.
 *
 * The file works in the browser (window.CalcEngine) and in Node.js
 * (require('./engine.js')) so the same code can be tested from the terminal.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();      // Node.js
  } else {
    root.CalcEngine = factory();     // Browser
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LENGTH = 500;   // longest expression we accept
  const MAX_DEPTH = 100;    // deepest nesting of brackets we accept

  // A CalcError is an "expected" problem (like dividing by zero).
  // Its message is shown to the user.
  class CalcError extends Error {}
  function fail(message) {
    throw new CalcError(message);
  }

  /* =========================================================================
   * STEP 1 - TOKENIZER
   * ========================================================================= */

  // Words the engine understands. Longer words come first so that
  // "asin" is not mistaken for "a" + "sin", and "exp" is not read as "e" + "xp".
  const WORDS = ['recip', 'asin', 'acos', 'atan', 'sqrt', 'cbrt', 'sin', 'cos',
                 'tan', 'abs', 'exp', 'log', 'mod', 'ans', 'ln', 'pi', 'e'];

  const FUNCTION_NAMES = new Set(['recip', 'asin', 'acos', 'atan', 'sqrt', 'cbrt',
                                  'sin', 'cos', 'tan', 'abs', 'exp', 'log', 'ln']);

  // Single-character symbols -> [token type, value]
  const SYMBOLS = {
    '+': ['op', '+'],
    '-': ['op', '-'],
    '−': ['op', '-'],      // the "nice" minus sign
    '*': ['op', '*'],
    '×': ['op', '*'],
    '/': ['op', '/'],
    '÷': ['op', '/'],
    '^': ['op', '^'],
    '(': ['lp', '('],
    ')': ['rp', ')'],
    '!': ['post', '!'],    // factorial
    '%': ['post', '%'],    // percent  (divides by 100)
    '²': ['post', '²'],    // squared
    '³': ['post', '³'],    // cubed
    '°': ['post', '°'],    // degrees
    'π': ['const', 'pi'],
    '√': ['func', 'sqrt'],
    '∛': ['func', 'cbrt']
  };

  function tokenize(source) {
    const tokens = [];
    let i = 0;

    while (i < source.length) {
      const ch = source[i];

      // skip spaces
      if (/\s/.test(ch)) { i++; continue; }

      // numbers: 12  3.5  .5  7.
      const numberMatch = /^(?:\d+\.?\d*|\.\d+)/.exec(source.slice(i));
      if (numberMatch) {
        const value = parseFloat(numberMatch[0]);
        if (!Number.isFinite(value)) fail('Number too large');
        tokens.push({ type: 'num', value: value, text: numberMatch[0] });
        i += numberMatch[0].length;
        continue;
      }

      // words: sin, cos, ln, pi, e, Ans, mod ...
      if (/[A-Za-z]/.test(ch)) {
        const rest = source.slice(i).toLowerCase();
        const word = WORDS.find(function (w) { return rest.startsWith(w); });
        if (!word) fail('Unknown name "' + source.slice(i, i + 5) + '"');

        if (FUNCTION_NAMES.has(word)) {
          tokens.push({ type: 'func', name: word, text: word });
        } else if (word === 'mod') {
          tokens.push({ type: 'op', value: 'mod', text: 'mod' });
        } else {
          tokens.push({ type: 'const', name: word, text: word });   // pi, e, ans
        }
        i += word.length;
        continue;
      }

      // one-character symbols
      const symbol = SYMBOLS[ch];
      if (!symbol) fail('Unexpected character "' + ch + '"');
      tokens.push({ type: symbol[0], value: symbol[1], name: symbol[1], text: ch });
      i++;
    }
    return tokens;
  }

  /* =========================================================================
   * HELPER MATH FUNCTIONS (each one checks for invalid input)
   * ========================================================================= */

  // Make sure a result is a real, finite number.
  function check(value) {
    if (Number.isNaN(value)) fail('Invalid calculation');
    if (!Number.isFinite(value)) fail('Result too large');
    return value;
  }

  // Remove tiny floating-point noise from trigonometry results,
  // e.g. sin(30°) = 0.49999999999999994 becomes 0.5.
  function cleanTrig(value) {
    if (Math.abs(value) < 1e-15) return 0;
    return Number(value.toPrecision(14));
  }

  // Reduce an angle in degrees to the range 0..359.999
  function reduceDegrees(x) {
    let a = x % 360;
    if (a < 0) a += 360;
    return a;
  }

  function sine(x, degrees) {
    if (degrees) {
      const a = reduceDegrees(x);
      if (a % 90 === 0) return [0, 1, 0, -1][a / 90];          // exact values
      return cleanTrig(Math.sin(a * Math.PI / 180));
    }
    return cleanTrig(Math.sin(x));
  }

  function cosine(x, degrees) {
    if (degrees) {
      const a = reduceDegrees(x);
      if (a % 90 === 0) return [1, 0, -1, 0][a / 90];          // exact values
      return cleanTrig(Math.cos(a * Math.PI / 180));
    }
    return cleanTrig(Math.cos(x));
  }

  function tangent(x, degrees) {
    if (degrees) {
      const a = reduceDegrees(x);
      if (a % 180 === 90) fail('tan is undefined at this angle');
      if (a % 180 === 0) return 0;
      return cleanTrig(Math.tan(a * Math.PI / 180));
    }
    if (Math.abs(Math.cos(x)) < 1e-15) fail('tan is undefined at this angle');
    return cleanTrig(Math.tan(x));
  }

  function factorial(n) {
    const whole = Math.round(n);
    if (Math.abs(n - whole) > 1e-9) fail('Factorial needs a whole number');
    if (whole < 0) fail('Factorial of a negative number');
    if (whole > 170) fail('Factorial too large (maximum is 170!)');
    let result = 1;
    for (let k = 2; k <= whole; k++) result *= k;
    return result;
  }

  function power(base, exponent) {
    if (base === 0 && exponent < 0) fail('Cannot divide by zero');
    const result = Math.pow(base, exponent);
    if (Number.isNaN(result)) fail('Invalid power (negative base with a fractional exponent)');
    if (!Number.isFinite(result)) fail('Result too large');
    return result;
  }

  function modulo(a, b) {
    if (b === 0) fail('Cannot divide by zero (mod 0)');
    let r = a % b;
    if (r !== 0 && (r < 0) !== (b < 0)) r += b;   // result takes the sign of b
    return r;
  }

  // Apply a named function such as sin, ln, sqrt ...
  function applyFunction(name, x, context) {
    const deg = context.angleMode === 'DEG';
    switch (name) {
      case 'sin': return sine(x, deg);
      case 'cos': return cosine(x, deg);
      case 'tan': return tangent(x, deg);
      case 'asin':
      case 'acos': {
        if (x < -1 || x > 1) fail(name + ': input must be between -1 and 1');
        const r = name === 'asin' ? Math.asin(x) : Math.acos(x);
        return cleanTrig(deg ? r * 180 / Math.PI : r);
      }
      case 'atan': {
        const r = Math.atan(x);
        return cleanTrig(deg ? r * 180 / Math.PI : r);
      }
      case 'sqrt':
        if (x < 0) fail('Square root of a negative number');
        return Math.sqrt(x);
      case 'cbrt': return Math.cbrt(x);
      case 'ln':
        if (x <= 0) fail('ln: input must be greater than 0');
        return Math.log(x);
      case 'log':
        if (x <= 0) fail('log: input must be greater than 0');
        return Math.log10(x);
      case 'abs': return Math.abs(x);
      case 'exp':
        if (x > 709) fail('Result too large');
        return Math.exp(x);
      case 'recip':
        if (x === 0) fail('Cannot divide by zero');
        return 1 / x;
      default:
        return fail('Unknown function "' + name + '"');
    }
  }

  /* =========================================================================
   * STEP 2 - PARSER  (recursive descent)
   *
   * Grammar, from the LOWEST to the HIGHEST priority:
   *
   *   expr    :=  term  ( (+ | -)  term )*
   *   term    :=  unary ( (× | ÷ | mod | implicit-multiply)  unary )*
   *   unary   :=  (+ | -) unary  |  power
   *   power   :=  postfix [ ^ unary ]          (right-to-left: 2^3^2 = 2^9)
   *   postfix :=  primary ( ! | % | ² | ³ | ° )*
   *   primary :=  number | constant | ( expr ) | function ( expr )
   *
   * Each rule is a small method below. Rules that sit LOWER in the list are
   * calculated FIRST, which is exactly how order of operations works.
   * ========================================================================= */

  class Parser {
    constructor(tokens, context) {
      this.tokens = tokens;
      this.pos = 0;
      this.context = context;
      this.depth = 0;
    }

    peek() { return this.tokens[this.pos]; }
    next() { return this.tokens[this.pos++]; }

    enter() {
      this.depth++;
      if (this.depth > MAX_DEPTH) fail('Expression is nested too deeply');
    }
    leave() { this.depth--; }

    parse() {
      const value = this.expr();
      if (this.pos < this.tokens.length) {
        const token = this.peek();
        if (token.type === 'rp') fail('Unmatched ")"');
        fail('Unexpected "' + token.text + '"');
      }
      return check(value);
    }

    // + and -
    expr() {
      let value = this.term();
      for (;;) {
        const token = this.peek();
        if (token && token.type === 'op' && (token.value === '+' || token.value === '-')) {
          this.pos++;
          const right = this.term();
          value = check(token.value === '+' ? value + right : value - right);
        } else {
          break;
        }
      }
      return value;
    }

    // × ÷ mod  and implicit multiplication such as 2π or 2(3+4)
    term() {
      let value = this.unary();
      for (;;) {
        const token = this.peek();
        if (!token) break;

        if (token.type === 'op' && (token.value === '*' || token.value === '/' || token.value === 'mod')) {
          this.pos++;
          const right = this.unary();
          if (token.value === '*') {
            value = check(value * right);
          } else if (token.value === '/') {
            if (right === 0) fail('Cannot divide by zero');
            value = check(value / right);
          } else {
            value = modulo(value, right);
          }
        } else if (token.type === 'num' || token.type === 'const' ||
                   token.type === 'func' || token.type === 'lp') {
          // implicit multiplication, but never "number number" (like "2 3")
          const previous = this.tokens[this.pos - 1];
          if (token.type === 'num' && previous.type === 'num') fail('Unexpected number "' + token.text + '"');
          value = check(value * this.unary());
        } else {
          break;
        }
      }
      return value;
    }

    // a leading + or -
    unary() {
      const token = this.peek();
      if (token && token.type === 'op' && (token.value === '-' || token.value === '+')) {
        this.pos++;
        this.enter();
        const value = this.unary();
        this.leave();
        return token.value === '-' ? -value : value;
      }
      return this.power();
    }

    // x ^ y   (so -2^2 = -(2^2) = -4, and 2^-1 = 0.5)
    power() {
      const base = this.postfix();
      const token = this.peek();
      if (token && token.type === 'op' && token.value === '^') {
        this.pos++;
        this.enter();
        const exponent = this.unary();
        this.leave();
        return power(base, exponent);
      }
      return base;
    }

    // ! % ² ³ °  written AFTER a value
    postfix() {
      let value = this.primary();
      for (;;) {
        const token = this.peek();
        if (!token || token.type !== 'post') break;
        this.pos++;
        switch (token.value) {
          case '!': value = factorial(value); break;
          case '%': value = value / 100; break;
          case '²': value = power(value, 2); break;
          case '³': value = power(value, 3); break;
          case '°':
            // "30°" always means 30 degrees. In DEG mode the number is already
            // in degrees; in RAD mode we convert it to radians.
            if (this.context.angleMode === 'RAD') value = value * Math.PI / 180;
            break;
          default: break;
        }
      }
      return value;
    }

    // numbers, constants, brackets, functions
    primary() {
      const token = this.next();
      if (!token) fail('Incomplete expression');

      switch (token.type) {
        case 'num':
          return token.value;

        case 'const':
          if (token.name === 'pi') return Math.PI;
          if (token.name === 'e') return Math.E;
          return this.context.ans;                    // "ans"

        case 'lp': {
          this.enter();
          const value = this.expr();
          this.closeBracket();
          this.leave();
          return value;
        }

        case 'func': {
          let argument;
          const following = this.peek();
          if (following && following.type === 'lp') {
            this.pos++;
            this.enter();
            argument = this.expr();
            this.closeBracket();
            this.leave();
          } else {
            // "√81" or "sin30" - the function takes the next value
            this.enter();
            argument = this.primary();
            this.leave();
          }
          return applyFunction(token.name, argument, this.context);
        }

        default:
          return fail('Unexpected "' + token.text + '"');
      }
    }

    // A missing ")" at the very end is closed automatically,
    // so typing "sin(30" and pressing "=" still works.
    closeBracket() {
      const token = this.peek();
      if (!token) return;
      if (token.type === 'rp') { this.pos++; return; }
      fail('Missing ")"');
    }
  }

  /* =========================================================================
   * STEP 3 - FORMATTING
   * ========================================================================= */

  // Keep 12 significant digits (hides tiny floating-point noise, 0.1+0.2 -> 0.3)
  function roundResult(value) {
    return Number(value.toPrecision(12));
  }

  // Number -> text for the display.
  function formatNumber(value) {
    if (!Number.isFinite(value)) return 'Error';
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e12 || abs < 1e-6) {
      // scientific notation, e.g. 1.5e+20
      return value.toExponential(11).replace(/\.?0+e/, 'e');
    }
    return String(Number(value.toPrecision(12)));
  }

  // Number -> text that can be typed back into the calculator (used by MR and history).
  // Negative numbers get brackets, and scientific notation is written as ×10^.
  function toInputString(value) {
    const text = formatNumber(value);
    let result = text;
    if (text.indexOf('e') !== -1) {
      const parts = text.split('e');
      result = '(' + parts[0] + '×10^' + parts[1].replace('+', '') + ')';
    } else if (value < 0) {
      result = '(' + text + ')';
    }
    return result;
  }

  /* =========================================================================
   * PUBLIC FUNCTION
   * evaluate("2×(3+4)", { angleMode: 'DEG', ans: 0 })
   *   -> { ok: true,  value: 14, text: "14" }
   *   -> { ok: false, error: "Cannot divide by zero" }
   * It NEVER throws, so the calculator cannot crash.
   * ========================================================================= */
  function evaluate(expression, options) {
    options = options || {};
    const context = {
      angleMode: options.angleMode === 'RAD' ? 'RAD' : 'DEG',
      ans: (typeof options.ans === 'number' && Number.isFinite(options.ans)) ? options.ans : 0
    };

    try {
      if (typeof expression !== 'string') fail('Invalid input');
      if (expression.length > MAX_LENGTH) fail('Expression is too long');

      const tokens = tokenize(expression);
      if (tokens.length === 0) fail('Empty expression');

      const value = roundResult(new Parser(tokens, context).parse());
      return { ok: true, value: value, text: formatNumber(value) };
    } catch (error) {
      if (error instanceof CalcError) return { ok: false, error: error.message };
      if (error instanceof RangeError) return { ok: false, error: 'Expression is too complex' };
      return { ok: false, error: 'Something went wrong' };
    }
  }

  return {
    evaluate: evaluate,
    formatNumber: formatNumber,
    toInputString: toInputString,
    tokenize: tokenize
  };
});
