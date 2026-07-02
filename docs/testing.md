# Testing JST components

JST components are real custom elements and render into light DOM. That makes
consumer tests straightforward: create normal DOM, register the `<script
type="jst">` template, set attributes/properties, and inspect/query the element
directly. There is no Shadow DOM test adapter and no framework-specific wrapper.

## jsdom with custom elements

Use a DOM environment that implements `customElements`, then import `jst.js`
after the globals are installed. The runtime self-initializes on import.

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

async function setup(html) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.customElements = dom.window.customElements;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.CustomEvent = dom.window.CustomEvent;

  await import('@br3nt/jst');
  return dom;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('counter renders and emits', async () => {
  const dom = await setup(`
    <script type="jst" name="x-counter" attributes="count">
      <button onclick="$(() => el.emit('increment', count + 1))">$(count || 0)</button>
    </script>
    <x-counter count="2"></x-counter>
  `);

  const counter = dom.window.document.querySelector('x-counter');
  await flush();

  assert.equal(counter.textContent.trim(), '2');

  let next = null;
  counter.addEventListener('increment', event => { next = event.detail; });
  counter.querySelector('button').click();
  assert.equal(next, 3);
});
```

Notes:

- Import JST after installing DOM globals; the module scans the current
  `document` immediately.
- Flush a microtask or timer tick after property/attribute writes because JST
  renders asynchronously.
- Query the component's own light DOM with `el.querySelector(...)`. There is no
  shadow root to pierce.

If your DOM emulator does not support custom elements reliably, run that test in
Playwright instead. Custom elements are platform behavior, so a browser test is
often simpler than polyfilling the platform.

## Playwright component-test pattern

For browser-accurate tests, serve the same static files your app serves and load
an HTML fixture or set the page content directly.

```js
import { test, expect } from '@playwright/test';

test('todo item toggles', async ({ page }) => {
  await page.addScriptTag({ type: 'module', path: 'node_modules/@br3nt/jst/jst.js' });
  await page.setContent(`
    <script type="jst" name="todo-item" attributes="item">
      <button onclick="$(() => el.emit('toggle', item))">$(item.text)</button>
    </script>
    <todo-item id="todo"></todo-item>
  `);

  await page.locator('#todo').evaluate(el => {
    el.item = { id: 1, text: 'Write tests' };
  });

  await expect(page.locator('#todo button')).toHaveText('Write tests');

  const detail = await page.evaluate(() => new Promise(resolve => {
    const el = document.querySelector('#todo');
    el.addEventListener('toggle', event => resolve(event.detail), { once: true });
    el.querySelector('button').click();
  }));

  expect(detail).toEqual({ id: 1, text: 'Write tests' });
});
```

For a larger app, prefer a fixture page:

```js
await page.goto('/components/todo-item.test.html');
await expect(page.locator('todo-item button')).toHaveText('Write tests');
```

Because JST uses light DOM, Playwright locators see the same nodes users and
server fragments see. Assertions stay close to the rendered HTML:
`page.locator('todo-item li')`, `toHaveText`, `toHaveAttribute`, and regular
`addEventListener` checks are usually enough.
