# NEXUS Scientific Calculator

A modern scientific calculator that runs in any web browser. It uses only **HTML, CSS and plain JavaScript**: no frameworks, no paid services, no internet connection needed.

The look (dark navy card, cyan glow, purple utility keys, cyan `=` key, sliding History panel) follows the reference screenshots you shared.

---

## 1. How to run it (Visual Studio Code)

**Easiest way**
1. Unzip the folder `scientific-calculator`.
2. Double-click `index.html`. It opens in your browser. Done.

**Recommended way (auto-refresh while you edit)**
1. Open VS Code, then **File > Open Folder...** and choose `scientific-calculator`.
2. Click the **Extensions** icon (four squares, left side) and install **Live Server** (by Ritwick Dey).
3. Right-click `index.html` in the file list and choose **Open with Live Server**.
4. Every time you save a file (Ctrl+S) the browser refreshes by itself.

**On an Android phone**: copy the whole folder to the phone and open `index.html` in Chrome, or host the folder for free on GitHub Pages / Netlify.

---

## 2. What each file does

| File | Job |
|---|---|
| `index.html` | The **structure**: every button and panel is written here. |
| `style.css` | The **look**: colours, sizes, dark/light theme, phone layout. |
| `engine.js` | The **math brain**: turns text like `2×(3+4)` into `14`. No `eval()`. |
| `script.js` | The **controller**: connects buttons and keyboard to the engine, draws the display, history and memory. |
| `tests.js` | Automatic tests for the engine (289 checks). |
| `tests.html` | Shows the same tests on a web page. |
| `TEST-RESULTS.txt` | The real output of the tests that were run. |

---

## 3. How to use it

* **AC** clears everything. **DEL** removes the last key (a whole `sin(` goes in one press).
* **DEG / RAD** switch (top left of the display) chooses the angle unit. The active one is highlighted.
* **MC / MR / M+ / M−** are the memory keys. A purple **M** badge shows when memory is not empty.
* **COPY** copies the current result.
* The **clock icon** opens the **History** panel. Tap a past result to reuse it. Your history is saved in the browser.
* The **sun/moon icon** switches between dark (default) and light theme.
* On narrow screens tap **ƒx** to show or hide the scientific keys. On tablets and desktop they are always visible.
* After `=`, pressing an operator continues with the answer (`5+5=` then `×2` gives 20). Pressing a number starts a new calculation.
* Missing closing brackets are added for you (`sin(30` then `=` works).
* If something is wrong (for example `1÷0`) the red message appears above the display and your expression stays so you can fix it.

### Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `0-9` `.` | digits | `s` `c` `t` | sin( cos( tan( |
| `+ - * /` `^` | operators (`x` also multiplies) | `r` | √( |
| `( )` | brackets | `l` `g` | ln( log( |
| `!` `%` | factorial, percent | `p` `e` | π, e |
| `Enter` or `=` | calculate | `a` | Ans |
| `Backspace` | DEL | `m` | mod |
| `Esc` | AC (closes History if open) | `d` | switch DEG/RAD |
| `Delete` | AC | `h` | open History |

---

## 4. How the math engine works (`engine.js`)

Think of it like reading a sentence:

1. **Tokenizer (cutting into words).** `2×(3+4)` becomes the pieces `2` `×` `(` `3` `+` `4` `)`. Anything it does not know (like `alert(1)`) is rejected, which is what makes it safe.
2. **Parser (understanding the grammar).** It reads the pieces by priority, lowest to highest: `+ −`, then `× ÷ mod`, then a leading minus, then powers `^`, then `! % ² ³ °`, then numbers, brackets and functions. That gives the correct order of operations (PEMDAS/BODMAS) and calculates as it goes.
3. **Checks.** Every step guards against division by zero, `ln(0)`, `√(−4)`, `tan(90°)`, `171!`, results that are too large, and so on. Errors come back as readable messages. The engine never throws, so the page cannot crash.
4. **Formatter.** Results are rounded to 12 significant digits (so `0.1+0.2` shows `0.3`). Numbers of 1e12 or more, or below 1e-6, use scientific notation.

Special care for angles: in DEG mode `sin(30)` is exactly `0.5`, `cos(90)` is exactly `0` and `tan(90)` is an error, instead of showing values like `6.1e-17`.

---

## 5. How to change things

**Change the name "NEXUS."** Open `index.html`, find `<h1>NEXUS<span>.</span></h1>` and change the text.

**Change colours.** Open `style.css`. The first block `:root { ... }` holds every colour. For example change `--accent: #2de2ee;` to another colour and the whole calculator follows.

**Add a button.** In `index.html`, copy an existing button and change its `data-` attribute:

| Attribute | What it does | Example |
|---|---|---|
| `data-digit="7"` | types a digit | `<button class="key" data-digit="7">7</button>` |
| `data-op="×"` | types an operator (`+ − × ÷ ^`) | |
| `data-insert="sin("` | types text (function, constant, bracket) | `data-insert="π"` |
| `data-post="²"` | types a symbol after a value (`² ³ ! % °`) | |
| `data-action="clear"` | runs an action (`clear delete calculate sign decimal mod mc mr mplus mminus`) | |

Example: a button for the golden ratio. Add `<button type="button" class="key fn const" data-insert="1.618034">φ</button>` inside `<section class="sci">`.

**Add a new math function** (for example `sinh`) in `engine.js`: add the word to `WORDS` and `FUNCTION_NAMES`, add a `case 'sinh':` in `applyFunction`, then add a button with `data-insert="sinh("`. Add a line to `tests.js` and run the tests.

---

## 6. Running the tests

* **Terminal (needs Node.js):** open a terminal in the folder and run `node tests.js`.
* **Browser:** open `tests.html`. Lines starting with `PASS` are good, `FAIL` needs attention.

### Test results (actually executed)

| Test | Result |
|---|---|
| Engine tests, `node tests.js` (Node 22): all 14 examples from the project brief in both DEG and RAD, order of operations, trig, factorial, percent, memory-free edge cases, error cases, unsafe input | **289 passed, 0 failed** |
| Interface tests in headless Chromium (Playwright): button clicks, keyboard, memory, history, copy, theme, DEG/RAD, saved settings after reload, 390 px phone, 320 px phone, tablet | **58 passed, 0 failed** in the final runs (see the note below about 2 checks that failed once), no JavaScript errors |

The 14 brief examples (`5+5`, `10−4`, `5×5`, `20÷4`, `2²`, `√81`, `2³`, `log(100)`, `ln(e)`, `sin(30°)`, `cos(60°)`, `tan(45°)`, `5!`, `2×(3+4)`) all give the expected answers in both DEG and RAD. The full list is in `TEST-RESULTS.txt`.

**Honest note about saved settings.** The two "still there after reload" checks (theme, history) failed in 2 of 6 full runs and in 1 of 15 extra loop runs when the page was opened as a plain `file://` page in headless Chromium. In the failing run the data had been saved correctly right before the reload, but the browser did not give it back afterwards. When the same test was served over `http://` (what Live Server does), it passed **15 out of 15** times. So: if you open `index.html` by double-clicking, your theme and history may occasionally not be remembered. Use **Live Server** (section 1) or host it online to make saving reliable. The calculator itself works the same either way.

**Not tested:** a real Android phone, Safari, and Firefox. The layout was checked in a simulated 390×844 and 320×640 screen only.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Page is blank or shows "engine.js missing" | `engine.js` must be in the same folder as `index.html`. |
| Buttons do nothing | Press F12, open the **Console** tab, and read the red message. Usually a typo from a recent edit. |
| Style changes do not show | Hard refresh with Ctrl+F5 (Cmd+Shift+R on Mac). |
| History or theme is not remembered | The browser blocks storage (private window or strict settings). The calculator still works. |
| "Cannot divide by zero", "Missing )" ... | These are normal messages. Fix the expression and press `=` again. |
| `sin(30)` looks wrong | Check the **DEG/RAD** switch. `sin(30)` is 0.5 in DEG and −0.988 in RAD. |

---

## 8. Known limitations

* `%` divides the number before it by 100 (`200×10%` = 20). It does not use the "add percent of the first number" rule of phone calculators, so `50+10%` gives 50.1, not 55.
* Results use 12 significant digits. Factorial works for whole numbers 0 to 170.
* No hyperbolic functions (sinh, cosh), no complex numbers, no unit conversion, no graphing.
* There is no "2nd" key; inverse trig has its own keys.
* History keeps the latest 50 calculations.
* The Copy button needs a secure page (https or local file) in some browsers; a fallback is included.

## 9. Ideas for the future

* Hyperbolic functions, nPr / nCr, random number, and a constants menu.
* Installable app (PWA) so it works offline from the phone home screen.
* Long-press on a key for its alternative function.
* Fraction display (`0.5` as `1/2`) and a `×10ˣ` key.
* Export history to a text file.
* A graph panel for `y = f(x)`.
