/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// Smoke-tests every example page in headless Chrome: loads it, clicks the
// buttons, and asserts the rendered DOM. Run with: node run_example_smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const filePath = path.join(rootDir, decodeURIComponent(url.pathname));

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const contentType = ({
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
      })[path.extname(filePath)] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

const flushSnippet = `const flush = () => new Promise(r => setTimeout(r, 50));`;

const checks = [
  {
    page: '/examples/jst_example.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      return { rendered: !!document.querySelector('jst-main h2') };
    })()`,
    assert: result => result.rendered === true,
  },
  {
    page: '/examples/basic_counter.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const counter = document.getElementById('my-counter');
      const before = counter.querySelector('.count')?.textContent;
      counter.querySelector('button').click();
      await flush();
      const after = counter.querySelector('.count')?.textContent;
      const running = counter.querySelector('.status')?.classList.contains('active');
      return { before, after, running };
    })()`,
    assert: result => result.before === '0' && result.after === '1' && result.running === true,
  },
  {
    page: '/examples/global_build.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const counter = document.getElementById('gc');
      const rendered = counter.querySelector('.count')?.textContent;
      const version = counter.querySelector('.ver')?.textContent;
      const hasGlobal = typeof window.JST?.version === 'string';
      counter.querySelector('button').click();
      await flush();
      const after = counter.querySelector('.count')?.textContent;
      return { rendered, after, version, hasGlobal };
    })()`,
    assert: result => result.rendered === '0' && result.after === '1'
      && result.hasGlobal === true && /^\d+\.\d+\.\d+/.test(result.version || ''),
  },
  {
    page: '/examples/runtime_precompiled.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const el = document.getElementById('g');
      const rendered = el.querySelector('.hi')?.textContent;
      // Runtime-only build: there is no compiler, so compiling an inline
      // template must throw rather than silently work.
      let compilerAbsent = false;
      try {
        window.JST.registerCustomElementFromTemplate({
          getAttribute: n => ({ name: 'rt-inline', props: 'm' }[n] ?? null),
          attributes: [], innerHTML: '<p>$(m)</p>',
        });
      } catch (e) { compilerAbsent = /runtime-only/.test(e.message); }
      return { rendered, compilerAbsent };
    })()`,
    assert: result => result.rendered === 'Hello, world!' && result.compilerAbsent === true,
  },
  {
    page: '/examples/counter_button.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const counter1 = document.getElementById('counter-1');
      document.querySelector('section .controls button').click();
      await flush();
      const incremented = counter1.textContent.includes('1');

      incrementSync();
      await flush();
      const syncValues = [...document.querySelectorAll('.sync-counter')].map(el => el.textContent.trim());

      const counter3 = document.getElementById('counter-3');
      counter3.querySelectorAll('button')[1].click();
      await flush();
      const counter3Value = counter3.querySelector('strong').textContent.trim();

      return { incremented, syncValues, counter3Value };
    })()`,
    assert: result => result.incremented
      && result.syncValues.every(value => value.includes('20'))
      && result.counter3Value === '101',
  },
  {
    page: '/examples/reverse_and_append.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const reversed = document.querySelector('jst-reverse strong')?.textContent;
      const initialItems = document.querySelectorAll('#append-list li').length;
      addItem();
      await flush();
      const afterAdd = document.querySelectorAll('#append-list li').length;
      clearItems();
      await flush();
      const emptyMessage = !!document.querySelector('#append-list em');
      return { reversed, initialItems, afterAdd, emptyMessage };
    })()`,
    assert: result => result.reversed === 'dlroW TSJ olleH'
      && result.initialItems === 1
      && result.afterAdd === 2
      && result.emptyMessage === true,
  },
  {
    page: '/examples/todo_app.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const list = document.getElementById('main-list');
      const initialCount = list.querySelectorAll('todo-item').length;

      list.querySelectorAll('todo-item')[2].querySelector('input').click();
      await flush();
      const toggledDone = list.querySelectorAll('todo-item')[2]
        .querySelector('.todo-item').classList.contains('done');

      document.getElementById('new-todo').value = 'New <b>item</b>';
      addTodo();
      await flush();
      const afterAdd = list.querySelectorAll('todo-item').length;
      const texts = [...list.querySelectorAll('todo-item .text')];
      const lastText = texts[texts.length - 1].textContent;
      const escaped = !list.querySelector('.text b');

      list.querySelector('todo-item button.del').click();
      await flush();
      const afterRemove = list.querySelectorAll('todo-item').length;

      setFilter('completed');
      await flush();
      const completedCount = list.querySelectorAll('todo-item').length;

      return { initialCount, toggledDone, afterAdd, lastText, escaped, afterRemove, completedCount };
    })()`,
    assert: result => result.initialCount === 3
      && result.toggledDone === true
      && result.afterAdd === 4
      && result.lastText === 'New <b>item</b>'
      && result.escaped === true
      && result.afterRemove === 3
      && result.completedCount === 2,
  },
  {
    page: '/examples/kanban.html',
    script: `(async () => {
      const flush = () => new Promise(r => setTimeout(r, 60));
      localStorage.removeItem('jst-kanban');
      await flush();
      const board = document.getElementById('board');
      const columnCount = document.querySelectorAll('kanban-column').length;
      const initialCards = document.querySelectorAll('kanban-card').length;

      // search filter narrows the board
      const search = document.querySelector('board-toolbar .search');
      search.value = 'drag';
      search.dispatchEvent(new Event('input'));
      await flush();
      const filtered = document.querySelectorAll('kanban-card').length;
      search.value = '';
      search.dispatchEvent(new Event('input'));
      await flush();

      // move card 7 to Done (same event the native drop handler emits)
      board.dispatchEvent(new CustomEvent('card-drop', { detail: { cardId: 7, columnId: 'done' } }));
      await flush();
      const doneColumn = [...document.querySelectorAll('kanban-column')]
        .find(col => col.querySelector('h2').textContent === 'Done');
      const doneCount = doneColumn.querySelectorAll('kanban-card').length;

      // click a card to open the editor, rename it, save
      document.querySelector('kanban-card .card').click();
      await flush();
      const editorOpen = !!document.querySelector('card-editor .overlay');
      document.querySelector('card-editor .f-title').value = 'Renamed by test';
      document.querySelector('card-editor .dialog-actions .primary').click();
      await flush();
      const renamed = [...document.querySelectorAll('kanban-card .card-title')]
        .some(el => el.textContent === 'Renamed by test');
      const editorClosed = !document.querySelector('card-editor .overlay');

      // add a brand new card through the editor
      document.querySelector('board-toolbar .add').click();
      await flush();
      document.querySelector('card-editor .f-title').value = 'Brand new card';
      document.querySelector('card-editor .dialog-actions .primary').click();
      await flush();
      const afterAdd = document.querySelectorAll('kanban-card').length;

      // delete a card
      document.querySelector('kanban-card .card-del').click();
      await flush();
      const afterDelete = document.querySelectorAll('kanban-card').length;

      // tag filter via clicking a tag chip, then clear it from the toolbar
      document.querySelector('kanban-card .tag').click();
      await flush();
      const tagFiltered = document.querySelectorAll('kanban-card').length;
      document.querySelector('board-toolbar .tag-filter').click();
      await flush();
      const tagCleared = document.querySelectorAll('kanban-card').length;

      // the htmx story: fetch a fragment that defines <kanban-stats>
      await loadInsights();
      await flush();
      const statsBars = document.querySelectorAll('kanban-stats .bar-row').length;
      const statsTotal = document.querySelector('kanban-stats .stat strong')?.textContent;

      localStorage.removeItem('jst-kanban');
      return { columnCount, initialCards, filtered, doneCount, editorOpen, renamed,
               editorClosed, afterAdd, afterDelete, tagFiltered, tagCleared, statsBars, statsTotal };
    })()`,
    assert: result => result.columnCount === 4
      && result.initialCards === 7
      && result.filtered === 1
      && result.doneCount === 2
      && result.editorOpen === true
      && result.renamed === true
      && result.editorClosed === true
      && result.afterAdd === 8
      && result.afterDelete === 7
      && result.tagFiltered === 1
      && result.tagCleared === 7
      && result.statsBars === 4
      && result.statsTotal === '7',
  },
  {
    page: '/examples/slots.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const cards = document.querySelectorAll('card-box');
      return {
        bodyProjected: !!cards[0].querySelector('.card-body p'),
        listProjected: cards[0].querySelectorAll('.card-body li').length,
        customFooter: cards[0].querySelector('.card-footer').textContent.trim(),
        fallbackFooter: cards[1].querySelector('.card-footer').textContent.trim(),
      };
    })()`,
    assert: result => result.bodyProjected === true
      && result.listProjected === 2
      && result.customFooter.startsWith('A custom footer')
      && result.fallbackFooter === 'No footer provided',
  },
  {
    // jst-layout is CSS-only: assert the stylesheet actually styles the
    // primitives, including the :has() positioning-container rule.
    page: '/examples/layout_primitives.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const switcher = getComputedStyle(document.querySelector('jst-switcher'));
      const imposter = document.querySelector('jst-imposter');
      return {
        primitives: document.querySelectorAll('jst-stack, jst-cluster, jst-grid, jst-sidebar, jst-center, jst-box, jst-switcher, jst-cover, jst-frame, jst-reel, jst-imposter, jst-icon').length,
        switcherFlex: switcher.display === 'flex',
        imposterAbsolute: getComputedStyle(imposter).position === 'absolute',
        containerPositioned: getComputedStyle(imposter.parentElement).position === 'relative',
      };
    })()`,
    assert: result => result.primitives >= 30
      && result.switcherFlex === true
      && result.imposterAbsolute === true
      && result.containerPositioned === true,
  },
  {
    page: '/examples/components_cross_section.html',
    script: `(async () => {
      ${flushSnippet}
      // The component definitions arrive via <jst-include> from the consumable
      // fragment, exactly as an app would load them: wait for the upgrade.
      await Promise.all(['jst-tabs', 'jst-palette', 'jst-toaster'].map(n => customElements.whenDefined(n)));
      await flush();
      const tabs = document.querySelector('jst-tabs');
      const before = tabs.querySelector('[role=tabpanel]').textContent;
      tabs.querySelectorAll('[role=tab]')[1].click();
      await flush();
      const after = tabs.querySelector('[role=tabpanel]').textContent;
      const selected = tabs.querySelectorAll('[role=tab]')[1].getAttribute('aria-selected');

      // The lazy region: scrolling the <jst-include when="visible"> into view
      // fetches the fragment, whose component definition auto-registers.
      const include = document.getElementById('team-include');
      include.scrollIntoView();
      const started = Date.now();
      while (!document.querySelector('team-stats strong') && Date.now() - started < 3000) await flush();
      const lazyStats = document.querySelectorAll('team-stats strong').length;

      // The lazy accordion: a closed details must NOT fetch, opening it must.
      const faq = document.getElementById('lazy-faq');
      faq.scrollIntoView({ block: 'center' });
      await flush(); await flush(); await flush();
      const faqLoadedClosed = !!faq.querySelector('[data-testid="faq-loaded"]');
      faq.open = true;
      const t1 = Date.now();
      while (!faq.querySelector('[data-testid="faq-loaded"]') && Date.now() - t1 < 3000) await flush();
      const faqLoadedOpen = !!faq.querySelector('[data-testid="faq-loaded"]');

      // Command palette: open via property, filter, run -> a toast lands.
      const palette = document.getElementById('palette');
      palette.open = true;
      await flush();
      const paletteOpened = !!palette.querySelector('input');
      palette.query = 'toast';
      await flush();
      const paletteFiltered = palette.querySelectorAll('[role=option]').length;
      palette.querySelector('[role=option]').click();
      await flush(); await flush();
      const paletteRan = !!document.querySelector('jst-toaster .jst-toast');
      const paletteClosed = !palette.querySelector('input');

      return { tabCount: tabs.querySelectorAll('[role=tab]').length, changed: before !== after, selected, lazyStats, faqLoadedClosed, faqLoadedOpen, paletteOpened, paletteFiltered, paletteRan, paletteClosed };
    })()`,
    assert: result => result.tabCount === 3
      && result.changed === true
      && result.selected === 'true'
      && result.lazyStats === 3
      && result.faqLoadedClosed === false
      && result.faqLoadedOpen === true
      && result.paletteOpened === true
      && result.paletteFiltered === 1
      && result.paletteRan === true
      && result.paletteClosed === true,
  },
  {
    // Third-party charts: three chart libraries, each inside a JST component.
    // The chart libraries load from a CDN, so every ASSERTED fact here is
    // JST-owned DOM: the page (and CI) must pass even if all three CDNs fail.
    // Library-specific facts are only returned for visibility, never asserted.
    page: '/examples/third_party_charts.html',
    script: `(async () => {
      ${flushSnippet}
      // jst.js is local, never a CDN, so the JST components always upgrade.
      await Promise.all(['charts-dashboard', 'chart-js-panel', 'uplot-panel', 'plot-panel']
        .map(n => customElements.whenDefined(n)));
      await flush(); await flush();

      // The page controller hands the dataset down as a property; wait for it.
      const sig = () => document.querySelector('[data-testid="signature"]').textContent.trim();
      const startedData = Date.now();
      while (sig() === '...' && Date.now() - startedData < 3000) await flush();

      const panels = document.querySelectorAll('chart-js-panel, uplot-panel, plot-panel').length;
      const frames = document.querySelectorAll('.chart-frame[jst-preserve]').length;

      // Randomize is JST state: emit up, page hands a new dataset down to all
      // three panels through the one attributes-down flow. Loop guards the rare
      // case where a random redraw lands on the same first value.
      const before = sig();
      let after = before;
      for (let i = 0; i < 5 && after === before; i++) {
        document.querySelector('.chart-controls button').click();
        await flush(); await flush();
        after = sig();
      }

      // Returned for visibility only (NOT asserted): did the CDNs load?
      const libs = {
        chartjs: typeof window.Chart !== 'undefined',
        uplot: typeof window.uPlot !== 'undefined',
        plot: typeof window.Plot !== 'undefined',
      };
      return { panels, frames, mutated: before !== after && after !== '...', libs };
    })()`,
    assert: result => result.panels === 3
      && result.frames === 3
      && result.mutated === true,
  },
  {
    // Web Awesome interop: wa-* components inside JST, both data directions plus
    // the theming bridge. Every ASSERTED fact is JST-owned DOM or a CSS token
    // mapping, so it passes even if the Web Awesome CDN is blocked. The one
    // wa-specific check is guarded on the component having actually upgraded.
    page: '/examples/webawesome_interop.html',
    script: `(async () => {
      ${flushSnippet}
      await Promise.all(['rating-driver', 'rating-catcher'].map(n => customElements.whenDefined(n)));
      await flush(); await flush();

      // Demo 1, attributes down: a JST +button mutates JST state (and the
      // wa-rating value it drives). The label is JST-owned.
      const driver = document.getElementById('driver');
      const driverBefore = document.querySelector('[data-testid="driver-stars"]').textContent;
      document.querySelectorAll('#driver button')[1].click(); // the "+"
      await flush(); await flush();
      const driverAfter = document.querySelector('[data-testid="driver-stars"]').textContent;

      // Demo 2, events up: fire the wa-rating change event; a JST handler writes
      // JST state that JST renders back out. Works whether or not wa upgraded.
      const rating = document.querySelector('#catcher wa-rating');
      rating.value = 4;
      rating.dispatchEvent(new Event('change', { bubbles: true }));
      await flush(); await flush();
      const caught = document.querySelector('[data-testid="catcher-rated"]')?.textContent;

      // Demo 3, theming bridge: the wa token is mapped from the jst token in CSS.
      const jstAccent = getComputedStyle(document.body).getPropertyValue('--jst-accent').trim();
      const waBrand = getComputedStyle(document.body).getPropertyValue('--wa-color-brand-fill-loud').trim();

      // Guarded wa-specific fact: only assert once the component upgraded.
      const waLoaded = !!customElements.get('wa-rating');
      const waRendered = waLoaded ? !!driver.querySelector('wa-rating').shadowRoot : true;

      return { driverBefore, driverAfter, caught, jstAccent, waBrand, waRendered, waLoaded };
    })()`,
    assert: result => result.driverBefore === '3'
      && result.driverAfter === '3.5'
      && result.caught === '4'
      && result.jstAccent.length > 0
      && result.waBrand === result.jstAccent
      && result.waRendered === true,
  },
];

async function waitForJson(baseUrl, pathName, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}${pathName}`);
      if (response.ok) return response.json();
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${baseUrl}${pathName}`);
}

async function stopChild(child, timeoutMs = 2000) {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, timeoutMs);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill('SIGTERM');
  });
}

async function main() {
  const server = createStaticServer(__dirname);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const serverPort = server.address().port;

  const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-smoke-'));
  const debugPort = 9223;

  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    // Keep rAF/timers running at full rate so CSS transitions progress promptly
    // even when the headless renderer is backgrounded/occluded (issue #18).
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  if (process.platform === 'linux') {
    chromeArgs.push('--no-sandbox', '--disable-dev-shm-usage');
  }
  const chrome = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

  let failures = 0;

  try {
    const baseUrl = `http://127.0.0.1:${debugPort}`;
    const targets = await waitForJson(baseUrl, '/json/list');
    const pageTarget = targets.find(target => target.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let nextId = 0;
    const pending = new Map();
    const send = (method, params = {}) => {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };

    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    });

    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    await send('Page.enable');
    await send('Runtime.enable');

    for (const check of checks) {
      await send('Page.navigate', { url: `http://127.0.0.1:${serverPort}${check.page}` });
      await new Promise(resolve => setTimeout(resolve, 500));

      const evaluated = await send('Runtime.evaluate', {
        expression: check.script,
        awaitPromise: true,
        returnByValue: true,
      });

      if (evaluated.exceptionDetails) {
        failures++;
        console.log(`FAIL ${check.page}: ${evaluated.exceptionDetails.text} ${evaluated.exceptionDetails.exception?.description || ''}`);
        continue;
      }

      const result = evaluated.result?.value;
      if (check.assert(result)) {
        console.log(`PASS ${check.page}`);
      } else {
        failures++;
        console.log(`FAIL ${check.page}: ${JSON.stringify(result)}`);
      }
    }

    ws.close();
  } finally {
    await stopChild(chrome);
    try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
    server.close();
  }

  if (failures > 0) process.exitCode = 1;
  console.log(failures === 0 ? 'All example pages passed.' : `${failures} example page(s) failed.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
