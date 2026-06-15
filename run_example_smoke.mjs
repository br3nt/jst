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

async function main() {
  const server = createStaticServer(__dirname);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const serverPort = server.address().port;

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-smoke-'));
  const debugPort = 9223;

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

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
    chrome.kill('SIGINT');
    await new Promise(resolve => chrome.once('exit', resolve));
    fs.rmSync(userDataDir, { recursive: true, force: true });
    server.close();
  }

  if (failures > 0) process.exitCode = 1;
  console.log(failures === 0 ? 'All example pages passed.' : `${failures} example page(s) failed.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
