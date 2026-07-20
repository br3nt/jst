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
    // The gallery shell: a plain HTML/CSS/vanilla-JS page (no jst.js) that
    // renders a manifest of cards, each an <iframe> to a mini page. Assert the
    // grid builds, badges carry literal tag text, and the re-skin dropdown
    // re-themes the shell and rewrites the standalone links.
    page: '/examples/components_cross_section.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const stages = document.querySelectorAll('.stage').length;
      const cards = document.querySelectorAll('.card').length;
      const iframes = document.querySelectorAll('.card iframe').length;
      const scrollingNo = [...document.querySelectorAll('.card iframe')].every(f => f.getAttribute('scrolling') === 'no');
      const themedSrc = [...document.querySelectorAll('.card iframe')].every(f => f.getAttribute('src').includes('?theme='));
      const hasTagBadge = [...document.querySelectorAll('.jst-tag')].some(b => b.textContent === '<jst-tabs>');
      // w3css exercises the digit-bearing theme name (regression: a
      // letters-only validation regex once rejected it).
      const sel = document.getElementById('theme');
      sel.value = 'w3css';
      sel.dispatchEvent(new Event('change'));
      await flush();
      const bodyThemed = document.body.dataset.theme === 'w3css';
      const link = document.querySelector('.card footer a');
      const linkThemed = link.getAttribute('href').includes('?theme=w3css');
      // View source: opening a <details> fetches the mini page and extracts the
      // markup between the example markers.
      const details = document.querySelector('.card details');
      const codeEl = details.querySelector('code');
      details.open = true;
      const started = Date.now();
      while ((codeEl.textContent === '' || codeEl.textContent.includes('Loading')) && Date.now() - started < 3000) await flush();
      const source = codeEl.textContent;
      // Lazy frames below the fold must still pick up the theme chosen above:
      // scroll the last card's frame into view and assert it renders shadcn.
      const lastFrame = [...document.querySelectorAll('.card iframe')].pop();
      lastFrame.scrollIntoView();
      const t2 = Date.now();
      while (lastFrame.contentDocument?.body?.dataset.theme !== 'w3css' && Date.now() - t2 < 3000) await flush();
      const lazyFrameThemed = lastFrame.contentDocument?.body?.dataset.theme === 'w3css';
      // Re-skin to astryx (the 12th skin) and confirm it propagates a distinct
      // variable value into a card frame — not just the [data-theme] flag but the
      // resolved --jst-radius the skin overrides (0.625rem, vs 0.1875rem default).
      sel.value = 'astryx';
      sel.dispatchEvent(new Event('change'));
      const firstFrame = document.querySelector('.card iframe');
      const t3 = Date.now();
      while (firstFrame.contentDocument?.body?.dataset.theme !== 'astryx' && Date.now() - t3 < 3000) await flush();
      const astryxThemed = firstFrame.contentDocument?.body?.dataset.theme === 'astryx';
      const astryxRadius = firstFrame.contentDocument
        ? getComputedStyle(firstFrame.contentDocument.body).getPropertyValue('--jst-radius').trim() : '';
      return { stages, cards, iframes, scrollingNo, themedSrc, hasTagBadge, bodyThemed, linkThemed, lazyFrameThemed, astryxThemed, astryxRadius, sourceLen: source.length, sourceHasMarkers: source.includes('example:') };
    })()`,
    assert: result => result.stages === 4
      && result.cards === 26
      && result.iframes === 26
      && result.scrollingNo === true
      && result.themedSrc === true
      && result.hasTagBadge === true
      && result.bodyThemed === true
      && result.linkThemed === true
      && result.lazyFrameThemed === true
      && result.astryxThemed === true
      && result.astryxRadius === '0.625rem'
      && result.sourceLen > 20
      && result.sourceHasMarkers === false,
  },
  {
    // The landing page embeds the FULL component gallery via the shared module
    // (regression: v0.7.9 had shrunk it to 3 mini frames + a link). Assert the
    // whole grid renders, EVERY iframe (the three app demos + all 26 cards) is
    // scrolling="no" (the scroll-stealing fix), the re-skin dropdown re-themes a
    // card frame, the hero JST component painted, and the runtime is preloaded.
    page: '/index.html',
    script: `(async () => {
      ${flushSnippet}
      await flush();
      const t0 = Date.now();
      while ((!document.querySelector('jst-demo-counter button')
              || document.querySelectorAll('#landing-gallery .card').length < 26)
             && Date.now() - t0 < 6000) await flush();
      const counterButton = !!document.querySelector('jst-demo-counter button');
      const cards = document.querySelectorAll('#landing-gallery .card').length;
      const allIframes = [...document.querySelectorAll('iframe')];
      const iframeCount = allIframes.length;
      const scrollingNo = allIframes.every(f => f.getAttribute('scrolling') === 'no');
      const preloads = [...document.querySelectorAll('link[rel="modulepreload"]')]
        .map(l => l.getAttribute('href'));
      const needed = ['jst.js','compiler.js','parser.js','interpreter.js','input_reader.js','lexer.js','tokens.js'];
      const preloadOk = needed.every(n => preloads.includes(n));
      // Re-skin to the digit-bearing theme, then confirm a card frame re-themes.
      const sel = document.getElementById('landing-theme');
      sel.value = 'w3css';
      sel.dispatchEvent(new Event('change'));
      await flush();
      const frame = document.querySelector('#landing-gallery .card iframe');
      frame.scrollIntoView();
      const t1 = Date.now();
      while (frame.contentDocument?.body?.dataset.theme !== 'w3css' && Date.now() - t1 < 4000) await flush();
      const frameThemed = frame.contentDocument?.body?.dataset.theme === 'w3css';
      // Then astryx: the re-skin propagates the astryx radius variable into the frame.
      sel.value = 'astryx';
      sel.dispatchEvent(new Event('change'));
      const t2 = Date.now();
      while (frame.contentDocument?.body?.dataset.theme !== 'astryx' && Date.now() - t2 < 4000) await flush();
      const astryxThemed = frame.contentDocument?.body?.dataset.theme === 'astryx';
      const astryxRadius = frame.contentDocument
        ? getComputedStyle(frame.contentDocument.body).getPropertyValue('--jst-radius').trim() : '';
      return { counterButton, cards, iframeCount, scrollingNo, preloadOk, frameThemed, astryxThemed, astryxRadius };
    })()`,
    assert: result => result.counterButton === true
      && result.cards === 26
      && result.iframeCount === 29
      && result.scrollingNo === true
      && result.preloadOk === true
      && result.frameThemed === true
      && result.astryxThemed === true
      && result.astryxRadius === '0.625rem',
  },
  {
    page: '/examples/components/modal.html',
    script: `(async () => { ${flushSnippet} await flush();
      const dlg = document.querySelector('dialog.jst-modal');
      const beforeOpen = dlg.open;
      document.querySelector('button[command="show-modal"]').click();
      await flush();
      const afterOpen = dlg.open;
      document.querySelector('.jst-modal-close').click();
      await flush();
      return { beforeOpen, afterOpen, closed: dlg.open };
    })()`,
    assert: r => r.beforeOpen === false && r.afterOpen === true && r.closed === false,
  },
  {
    page: '/examples/components/drawer.html',
    script: `(async () => { ${flushSnippet} await flush();
      const d = document.getElementById('demo-drawer');
      document.querySelector('button[data-side="start"]').click();
      await flush();
      return { open: d.open, side: d.dataset.side };
    })()`,
    assert: r => r.open === true && r.side === 'start',
  },
  {
    page: '/examples/components/dropdown.html',
    script: `(async () => { ${flushSnippet} await flush();
      const menu = document.getElementById('demo-menu');
      const before = menu.matches(':popover-open');
      document.querySelector('button[commandfor="demo-menu"]').click();
      await flush();
      return { before, after: menu.matches(':popover-open'), items: menu.querySelectorAll('button').length };
    })()`,
    assert: r => r.before === false && r.after === true && r.items === 4,
  },
  {
    page: '/examples/components/accordion.html',
    script: `(async () => { ${flushSnippet} await flush();
      const items = document.querySelectorAll('.jst-accordion details');
      const firstOpenInit = items[0].open;
      items[1].querySelector('summary').click();
      await flush();
      return { count: items.length, firstOpenInit, firstAfter: items[0].open, secondAfter: items[1].open };
    })()`,
    assert: r => r.count === 3 && r.firstOpenInit === true && r.firstAfter === false && r.secondAfter === true,
  },
  {
    page: '/examples/components/switch.html',
    script: `(async () => { ${flushSnippet} await flush();
      const boxes = document.querySelectorAll('.jst-switch input[type=checkbox]');
      return { count: boxes.length, firstChecked: boxes[0].checked };
    })()`,
    assert: r => r.count === 2 && r.firstChecked === true,
  },
  {
    page: '/examples/components/tooltip.html',
    script: `(async () => { ${flushSnippet} await flush();
      const tip = document.querySelector('.jst-tooltip');
      return { hasTip: !!tip && tip.hasAttribute('data-tip') };
    })()`,
    assert: r => r.hasTip === true,
  },
  {
    page: '/examples/components/alert.html',
    script: `(async () => { ${flushSnippet} await flush();
      const total = document.querySelectorAll('.jst-alert').length;
      const plainVariants = [...document.querySelectorAll('jst-stack:not(#dismissable) > .jst-alert')]
        .map(a => a.dataset.variant).join(',');
      // Dismissing a dismissable alert animates it out and removes the node.
      const before = document.querySelectorAll('#dismissable .jst-alert').length;
      document.querySelector('#dismissable [data-dismiss]').click();
      const started = Date.now();
      while (document.querySelectorAll('#dismissable .jst-alert').length === before && Date.now() - started < 2000) await flush();
      const after = document.querySelectorAll('#dismissable .jst-alert').length;
      return { total, plainVariants, before, after };
    })()`,
    assert: r => r.total === 5 && r.plainVariants === 'success,warning,error'
      && r.before === 2 && r.after === 1,
  },
  {
    page: '/examples/components/progress.html',
    script: `(async () => { ${flushSnippet} await flush();
      const p = document.querySelector('progress.jst-progress');
      return { value: p.value, spinner: !!document.querySelector('.jst-spinner') };
    })()`,
    assert: r => r.value === 0.66 && r.spinner === true,
  },
  {
    page: '/examples/components/badge.html',
    script: `(async () => { ${flushSnippet} await flush();
      return { badges: document.querySelectorAll('.jst-badge').length, avatars: document.querySelectorAll('.jst-avatar').length };
    })()`,
    assert: r => r.badges === 5 && r.avatars === 2,
  },
  {
    page: '/examples/components/skeleton.html',
    script: `(async () => { ${flushSnippet}
      await customElements.whenDefined('jst-include'); await flush();
      // First load: the include's skeleton children swap out for the fragment.
      const t0 = Date.now();
      while (!document.querySelector('#swap-slot team-stats strong') && Date.now() - t0 < 3000) await flush();
      const shapeSkeletons = document.querySelectorAll('jst-switcher .jst-skeleton').length;
      const loadedInitially = !!document.querySelector('#swap-slot team-stats strong');
      // Replay stages the skeleton, then re-runs the swap to the loaded content.
      document.getElementById('replay').click();
      const t1 = Date.now();
      while (!document.querySelector('#swap-slot .jst-skeleton') && Date.now() - t1 < 2000) await flush();
      const skeletonDuringReplay = !!document.querySelector('#swap-slot .jst-skeleton')
        && !document.querySelector('#swap-slot team-stats strong');
      const t2 = Date.now();
      while (!document.querySelector('#swap-slot team-stats strong') && Date.now() - t2 < 4000) await flush();
      const reloaded = !!document.querySelector('#swap-slot team-stats strong');
      return { shapeSkeletons, loadedInitially, skeletonDuringReplay, reloaded };
    })()`,
    assert: r => r.shapeSkeletons === 9 && r.loadedInitially === true
      && r.skeletonDuringReplay === true && r.reloaded === true,
  },
  {
    page: '/examples/components/breadcrumb.html',
    script: `(async () => { ${flushSnippet} await flush();
      return { crumb: !!document.querySelector('.jst-breadcrumb'), pag: !!document.querySelector('.jst-pagination'),
        current: document.querySelector('.jst-breadcrumb [aria-current="page"]').textContent };
    })()`,
    assert: r => r.crumb === true && r.pag === true && r.current === '#4471',
  },
  {
    page: '/examples/components/input-group.html',
    script: `(async () => { ${flushSnippet} await flush();
      return { joins: document.querySelectorAll('.jst-join').length, addon: !!document.querySelector('.jst-addon') };
    })()`,
    assert: r => r.joins === 2 && r.addon === true,
  },
  {
    page: '/examples/components/button-variants.html',
    script: `(async () => { ${flushSnippet} await flush();
      return { count: document.querySelectorAll('button').length,
        hasDanger: !!document.querySelector('[data-variant="danger"]'),
        disabled: !!document.querySelector('button[disabled]') };
    })()`,
    assert: r => r.count === 5 && r.hasDanger === true && r.disabled === true,
  },
  {
    page: '/examples/components/page-header.html',
    script: `(async () => { ${flushSnippet} await flush();
      return { header: !!document.querySelector('.jst-page-header'),
        income: document.querySelector('[data-testid="stat-income"]').textContent,
        stats: document.querySelectorAll('.jst-stat').length };
    })()`,
    assert: r => r.header === true && r.income === '$8,120' && r.stats === 3,
  },
  {
    page: '/examples/components/empty-state.html',
    script: `(async () => { ${flushSnippet} await flush();
      const list = document.getElementById('members');
      const empty = document.getElementById('empty');
      const initialRows = list.querySelectorAll('li').length;
      const emptyHiddenInitially = empty.hidden;
      // Remove every row → the empty state takes over.
      [...list.querySelectorAll('[data-remove]')].forEach(b => b.click());
      await flush();
      const rowsAfterClear = list.querySelectorAll('li').length;
      const emptyVisible = !empty.hidden && list.hidden;
      // Invite adds a member back → empty hides again.
      document.getElementById('invite').click();
      await flush();
      const rowsAfterInvite = list.querySelectorAll('li').length;
      const emptyHiddenAgain = empty.hidden;
      return { initialRows, emptyHiddenInitially, rowsAfterClear, emptyVisible, rowsAfterInvite, emptyHiddenAgain };
    })()`,
    assert: r => r.initialRows === 2 && r.emptyHiddenInitially === true
      && r.rowsAfterClear === 0 && r.emptyVisible === true
      && r.rowsAfterInvite === 1 && r.emptyHiddenAgain === true,
  },
  {
    page: '/examples/components/validation.html',
    script: `(async () => { ${flushSnippet} await flush();
      const input = document.getElementById('val-email');
      const requiredInvalid = input.matches(':invalid');
      input.value = 'nope';
      const stillInvalid = input.matches(':invalid');
      input.value = 'a@b.com';
      const nowValid = input.matches(':valid');
      // TLD-required field: type=email is happy with a@b, the pattern is not.
      const tld = document.getElementById('val-email-tld');
      tld.value = 'a@b';
      const tldTypeOk = !tld.validity.typeMismatch;
      const tldPatternRejects = tld.validity.patternMismatch && tld.matches(':invalid');
      tld.value = 'a@b.com';
      const tldValid = tld.matches(':valid');
      return { requiredInvalid, stillInvalid, nowValid, tldTypeOk, tldPatternRejects, tldValid };
    })()`,
    assert: r => r.requiredInvalid === true && r.stillInvalid === true && r.nowValid === true
      && r.tldTypeOk === true && r.tldPatternRejects === true && r.tldValid === true,
  },
  {
    page: '/examples/components/carousel.html',
    script: `(async () => { ${flushSnippet} await flush();
      const reel = document.querySelector('jst-reel[data-carousel]');
      return { frames: reel.querySelectorAll('jst-frame').length, scrollable: reel.scrollWidth > reel.clientWidth };
    })()`,
    assert: r => r.frames === 3 && r.scrollable === true,
  },
  {
    page: '/examples/components/container-query.html',
    script: `(async () => { ${flushSnippet} await flush();
      return { container: !!document.querySelector('[data-container]'), stats: document.querySelectorAll('.jst-stat').length };
    })()`,
    assert: r => r.container === true && r.stats === 3,
  },
  {
    // Reveal-on-scroll must have its own scrollport so animation-timeline: view()
    // has something to track; assert the box scrolls, holds the reveal cards, and
    // (where the engine gives the timeline a currentTime — some environments leave
    // view() timelines inactive) actually hides below-fold cards until scrolled to.
    page: '/examples/components/reveal-on-scroll.html',
    script: `(async () => { ${flushSnippet} await flush();
      const box = document.querySelector('.reveal-scroller');
      const items = [...box.querySelectorAll('.jst-reveal')];
      const last = items[items.length - 1];
      const active = !!(last && last.getAnimations()[0]?.timeline?.currentTime !== null && last.getAnimations()[0]);
      box.scrollTop = 0; await new Promise(r => setTimeout(r, 250));
      const hiddenAtTop = last ? getComputedStyle(last).opacity === '0' : false;
      box.scrollTop = box.scrollHeight; await new Promise(r => setTimeout(r, 250));
      const shownAtBottom = last ? getComputedStyle(last).opacity === '1' : false;
      return { scrollable: box.scrollHeight > box.clientHeight, reveals: items.length, active, hiddenAtTop, shownAtBottom };
    })()`,
    assert: r => r.scrollable === true && r.reveals === 4 &&
      (r.active === false || (r.hiddenAtTop === true && r.shownAtBottom === true)),
  },
  {
    page: '/examples/components/tabs.html',
    script: `(async () => { ${flushSnippet}
      await customElements.whenDefined('jst-tabs'); await flush();
      const tabs = document.querySelector('jst-tabs');
      const before = tabs.querySelector('[role=tabpanel]').textContent;
      tabs.querySelectorAll('[role=tab]')[1].click();
      await flush();
      const after = tabs.querySelector('[role=tabpanel]').textContent;
      const selected = tabs.querySelectorAll('[role=tab]')[1].getAttribute('aria-selected');
      return { count: tabs.querySelectorAll('[role=tab]').length, changed: before !== after, selected };
    })()`,
    assert: r => r.count === 3 && r.changed === true && r.selected === 'true',
  },
  {
    page: '/examples/components/combobox.html',
    script: `(async () => { ${flushSnippet}
      await customElements.whenDefined('jst-combobox'); await flush();
      // Static combobox: filters the JSON options client-side.
      const stat = document.getElementById('fruit-combobox');
      stat.query = 'ap'; stat.open = true;
      await flush();
      const staticOpts = [...stat.querySelectorAll('[role=option]')].map(o => o.textContent);

      // Async combobox: focus and type into the inner field; a debounced handler
      // fetches from the simulated remote catalog and assigns el.options.
      const asyncCb = document.getElementById('catalog-combobox');
      const field = asyncCb.querySelector('input');
      field.focus();
      field.value = 'man';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      const started = Date.now();
      while (asyncCb.querySelectorAll('[role=option]').length === 0 && Date.now() - started < 3000) await flush();
      const asyncOpts = [...asyncCb.querySelectorAll('[role=option]')].map(o => o.textContent);
      return { staticCount: staticOpts.length, staticFirst: staticOpts[0], asyncOpts };
    })()`,
    assert: r => r.staticCount === 3 && r.staticFirst === 'Apple'
      && r.asyncOpts.length === 2 && r.asyncOpts.includes('Mandarin') && r.asyncOpts.includes('Mango'),
  },
  {
    page: '/examples/components/table.html',
    script: `(async () => { ${flushSnippet}
      await customElements.whenDefined('jst-table'); await flush();
      const table = document.querySelector('jst-table');
      table.querySelectorAll('th button')[2].click();
      await flush();
      const th = table.querySelectorAll('th')[2];
      return { rows: table.querySelectorAll('tbody tr').length, sort: th.getAttribute('aria-sort'),
        firstCell: table.querySelector('tbody tr td').textContent };
    })()`,
    assert: r => r.rows === 4 && r.sort === 'ascending' && r.firstCell === 'Alan',
  },
  {
    page: '/examples/components/toaster.html',
    script: `(async () => { ${flushSnippet}
      await customElements.whenDefined('jst-toaster'); await flush();
      document.querySelector('button[data-variant="success"]').click();
      await flush(); await flush();
      return { viaCommand: document.querySelectorAll('jst-toaster .jst-toast').length };
    })()`,
    assert: r => r.viaCommand === 1,
  },
  {
    page: '/examples/components/lazy-region.html',
    script: `(async () => { ${flushSnippet}
      const started = Date.now();
      while (!document.querySelector('team-stats strong') && Date.now() - started < 3000) await flush();
      return { stats: document.querySelectorAll('team-stats strong').length };
    })()`,
    assert: r => r.stats === 3,
  },
  {
    page: '/examples/components/lazy-accordion.html',
    script: `(async () => { ${flushSnippet} await flush(); await flush();
      const faq = document.getElementById('lazy-faq');
      const loadedClosed = !!faq.querySelector('[data-testid="faq-loaded"]');
      faq.open = true;
      const t = Date.now();
      while (!faq.querySelector('[data-testid="faq-loaded"]') && Date.now() - t < 3000) await flush();
      return { loadedClosed, loadedOpen: !!faq.querySelector('[data-testid="faq-loaded"]') };
    })()`,
    assert: r => r.loadedClosed === false && r.loadedOpen === true,
  },
  {
    page: '/examples/components/command-palette.html',
    script: `(async () => { ${flushSnippet}
      await Promise.all(['jst-palette', 'jst-toaster'].map(n => customElements.whenDefined(n)));
      await flush(); await flush();
      const palette = document.getElementById('palette');
      palette.open = true; await flush();
      const opened = !!palette.querySelector('input');
      palette.query = 'toast'; await flush();
      const filtered = palette.querySelectorAll('[role=option]').length;
      palette.querySelector('[role=option]').click();
      await flush(); await flush();
      const ran = !!document.querySelector('jst-toaster .jst-toast');
      const closed = !palette.querySelector('input');
      return { opened, filtered, ran, closed };
    })()`,
    assert: r => r.opened === true && r.filtered === 1 && r.ran === true && r.closed === true,
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
    // the theming bridge. Every ASSERTED fact is JST-owned DOM or a CSS variable
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

      // Demo 3, theming bridge: the wa variable is mapped from the jst variable in CSS.
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
  {
    // Platform recipes: everything on this page is either plain HTML/CSS or
    // one JST component (scroll-spy); jst.js is local, never a CDN, so the
    // whole page is hermetic. Assert real behavior per recipe, not just DOM
    // presence: the progress ring's --value, the context-menu popover opening
    // from its invoker, and the scrollspy TOC actually rendering links.
    page: '/examples/platform_recipes.html',
    script: `(async () => {
      ${flushSnippet}
      await customElements.whenDefined('scroll-spy');
      await flush();

      const cards = document.querySelectorAll('.recipe').length;

      const ring = document.querySelector('.ring-demo');
      const ringValue = getComputedStyle(ring).getPropertyValue('--value').trim();

      const menu = document.getElementById('r9-menu');
      const menuOpenBefore = menu.matches(':popover-open');
      document.querySelector('button[commandfor="r9-menu"]').click();
      await flush();
      const menuOpenAfter = menu.matches(':popover-open');

      const tocLinks = document.querySelectorAll('.spy-toc a').length;

      // Docs sidebar nav: an IntersectionObserver rooted at the scroll pane
      // drives the active sidebar item. Assert the initial active item, then
      // scroll the pane to the bottom and confirm the active marker moves.
      const sideLinks = document.querySelectorAll('#recipe-sidebar-nav .sidenav-rail a').length;
      const activeInitial = document.querySelector('#recipe-sidebar-nav .sidenav-rail a[aria-current="true"]')?.textContent.trim();
      const pane = document.querySelector('#recipe-sidebar-nav .sidenav-content');
      pane.scrollTo(0, pane.scrollHeight);
      let activeAfter = activeInitial;
      const startedSpy = Date.now();
      while (activeAfter === 'Install' && Date.now() - startedSpy < 2000) {
        await flush();
        activeAfter = document.querySelector('#recipe-sidebar-nav .sidenav-rail a[aria-current="true"]')?.textContent.trim();
      }

      return { cards, ringValue, menuOpenBefore, menuOpenAfter, tocLinks,
               sideLinks, activeInitial, activeAfter };
    })()`,
    assert: result => result.cards === 15
      && result.ringValue === '68'
      && result.menuOpenBefore === false
      && result.menuOpenAfter === true
      && result.tocLinks === 4
      && result.sideLinks === 4
      && result.activeInitial === 'Install'
      && !!result.activeAfter
      && result.activeAfter !== 'Install',
  },
  {
    // Template recipes: JST-owned DOM and behavior that works with no CDN.
    // Markdown and QR are third-party-CDN-dependent (see the module script at
    // the top of the page); assert only that their containers exist, never
    // their rendered internals, so this check stays offline-safe.
    page: '/examples/template_recipes.html',
    script: `(async () => {
      ${flushSnippet}
      await Promise.all(['jst-rating', 'jst-copy-button', 'jst-relative-time',
        'jst-format-bytes', 'jst-format-number', 'jst-format-date',
        'markdown-block', 'qr-code'].map(n => customElements.whenDefined(n)));
      await flush(); await flush();

      const rating = document.getElementById('demo-rating');
      const starsBefore = rating.querySelectorAll('.star[data-fill="full"]').length;
      const readoutBefore = document.getElementById('rating-readout').textContent;
      rating.querySelectorAll('.hit.right')[4].click();
      await flush();
      const starsAfter = rating.querySelectorAll('.star[data-fill="full"]').length;
      const readoutAfter = document.getElementById('rating-readout').textContent;

      const copyButtons = document.querySelectorAll('jst-copy-button .copy-btn').length;

      const relativeTimeText = document.querySelector('#rt-seconds time')?.textContent.trim();

      const relativeTimeOutputs = document.querySelectorAll('#recipe-relative-time .fmt-grid dd').length;
      const formatBytesOutputs = document.querySelectorAll('#recipe-format-bytes .fmt-grid dd').length;
      const formatBytesText = document.querySelector('jst-format-bytes')?.textContent.trim();
      const formatNumberDateOutputs = document.querySelectorAll('#recipe-format .fmt-grid dd').length;
      const formatCurrencyText = document.querySelector('jst-format-number')?.textContent.trim();

      const markdownContainer = !!document.querySelector('#recipe-markdown .md-rendered');
      const qrContainer = !!document.querySelector('#recipe-qr .qr-frame');

      return { starsBefore, readoutBefore, starsAfter, readoutAfter, copyButtons,
        relativeTimeText, relativeTimeOutputs, formatBytesOutputs, formatBytesText,
        formatNumberDateOutputs, formatCurrencyText, markdownContainer, qrContainer };
    })()`,
    assert: result => result.starsBefore === 3
      && result.readoutBefore === '3 / 5'
      && result.starsAfter === 5
      && result.readoutAfter === '5 / 5'
      && result.copyButtons === 2
      && !!result.relativeTimeText && result.relativeTimeText.length > 0
      && result.relativeTimeOutputs === 5
      && result.formatBytesOutputs === 6
      && !!result.formatBytesText && result.formatBytesText.length > 0
      && result.formatNumberDateOutputs === 8
      && !!result.formatCurrencyText && result.formatCurrencyText.length > 0
      && result.markdownContainer === true
      && result.qrContainer === true,
  },
  /* --- hateoas_recipes checks --- */
  {
    // Server-driven interactions page. The whole point is that nothing on the
    // wire is JSON: a form body or query string goes out, a rendered HTML
    // fragment comes back. Drive the four load-bearing recipes end to end and
    // read the visible wire log to prove the contract.
    page: '/examples/hateoas_recipes.html',
    script: `(async () => {
      ${flushSnippet}
      // Wait for the module to bootstrap the regions and expose its helpers.
      const t0 = Date.now();
      while ((typeof window.__reorder !== 'function'
              || !document.querySelector('#r1-list .task')) && Date.now() - t0 < 4000) await flush();

      // R1 — drag-drop reorder: move the first task to the end via the same
      // function the drop handler calls. DOM order must change, and the wire log
      // must show a form-encoded POST with an HTML response.
      const orderBefore = [...document.querySelectorAll('#r1-list .task')].map(t => t.dataset.id).join(',');
      const firstId = document.querySelector('#r1-list .task').dataset.id;
      await window.__reorder(Number(firstId), 'end');
      let orderAfter = orderBefore, t1 = Date.now();
      while (orderAfter === orderBefore && Date.now() - t1 < 2000) {
        await flush();
        orderAfter = [...document.querySelectorAll('#r1-list .task')].map(t => t.dataset.id).join(',');
      }
      const r1Changed = orderAfter !== orderBefore;
      const r1Wire = document.querySelector('[data-wire="r1"]').textContent;

      // R3 — click to edit: open the edit form for contact 1, rename, save.
      // Re-query #c-1 each time because outerHTML swaps replace the node.
      document.querySelector('#c-1 .edit').click();
      let t2 = Date.now();
      while (!document.querySelector('#c-1 form') && Date.now() - t2 < 2000) await flush();
      const inp = document.querySelector('#c-1 input[name="name"]');
      inp.value = 'Renamed Person';
      document.querySelector('#c-1 form').requestSubmit();
      t2 = Date.now();
      const renamed = () => (document.querySelector('#c-1') || {}).textContent || '';
      while ((!renamed().includes('Renamed Person') || document.querySelector('#c-1 form')) && Date.now() - t2 < 2000) await flush();
      const r3Renamed = renamed().includes('Renamed Person');
      const r3FormGone = !document.querySelector('#c-1 form');

      // R7 — delete then undo: the undo affordance rides in the returned HTML.
      const r7NotesBefore = document.querySelectorAll('#r7-region .note').length;
      document.querySelector('#r7-region .note form.delete').requestSubmit();
      let t3 = Date.now();
      while (document.querySelectorAll('#r7-region .note').length === r7NotesBefore && Date.now() - t3 < 2000) await flush();
      const r7AfterDelete = document.querySelectorAll('#r7-region .note').length;
      t3 = Date.now();
      while (!document.querySelector('#r7-region .toast form') && Date.now() - t3 < 2000) await flush();
      document.querySelector('#r7-region .toast form').requestSubmit();
      t3 = Date.now();
      while (document.querySelectorAll('#r7-region .note').length === r7AfterDelete && Date.now() - t3 < 2000) await flush();
      const r7AfterUndo = document.querySelectorAll('#r7-region .note').length;
      const r7ToastGone = !document.querySelector('#r7-region .toast');

      // R9 — job with self-terminating polling: run to the finished fragment and
      // confirm no further requests land after the hypermedia drops the trigger.
      document.querySelector('#r9-generate').click();
      let t4 = Date.now();
      const region = () => document.querySelector('#r9-region');
      while ((document.querySelector('#r9-region [data-poll]')
              || !region().textContent.includes('Report ready')) && Date.now() - t4 < 5000) await flush();
      const r9Done = !document.querySelector('#r9-region [data-poll]') && region().textContent.includes('Report ready');
      const r9WireAtDone = document.querySelectorAll('[data-wire="r9"] .wire-row').length;
      await new Promise(r => setTimeout(r, 700));
      const r9WireLater = document.querySelectorAll('[data-wire="r9"] .wire-row').length;

      // No JSON anywhere on the wire — scan every wire panel.
      const panels = [...document.querySelectorAll('[data-wire]')];
      const noJson = !panels.some(p => p.textContent.includes('application/json'));
      const anyWire = panels.some(p => p.querySelector('.wire-row'));

      return { r1Changed, r1Wire, r3Renamed, r3FormGone,
               r7NotesBefore, r7AfterDelete, r7AfterUndo, r7ToastGone,
               r9Done, r9WireAtDone, r9WireLater, noJson, anyWire };
    })()`,
    assert: r => r.r1Changed === true
      && r.r1Wire.includes('POST') && r.r1Wire.includes('/tasks/reorder')
      && r.r1Wire.includes('application/x-www-form-urlencoded') && r.r1Wire.includes('id=')
      && r.r1Wire.includes('text/html') && r.r1Wire.includes('<li')
      && r.r3Renamed === true && r.r3FormGone === true
      && r.r7AfterDelete === r.r7NotesBefore - 1
      && r.r7AfterUndo === r.r7NotesBefore && r.r7ToastGone === true
      && r.r9Done === true && r.r9WireAtDone >= 4 && r.r9WireLater === r.r9WireAtDone
      && r.noJson === true && r.anyWire === true,
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
