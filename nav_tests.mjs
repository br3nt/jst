/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs · https://github.com/br3nt/jst · MIT
 */

/**
 * swapContent() unit tests (#49): a View Transition, forced by the final
 * forceTransition param, must wrap ANY swap mode — not just the legacy
 * jst-swap="transition" alias — and degrade to a plain swap when the API is
 * unavailable. These run against a minimal DOM stub (no browser needed); the
 * declarative jst-transition attribute and navigate({ transition: true })
 * paths that feed forceTransition are covered in run_tests.html.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.document = { readyState: 'complete', visibilityState: 'visible' };

const { swapContent } = await import('./jst-nav.js');

function makeTarget() {
  return {
    isConnected: true,
    innerHTML: '',
    outerHTML: '',
    insertAdjacentHTML() {},
    remove() {},
  };
}

function spyOnStartViewTransition() {
  let calls = 0;
  globalThis.document.startViewTransition = (update) => {
    calls++;
    update();
    return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve() };
  };
  return () => calls;
}

test('swapContent: forceTransition wraps a plain innerHTML swap in a View Transition', async () => {
  const target = makeTarget();
  const calls = spyOnStartViewTransition();
  try {
    const wrote = await swapContent(target, '<p>hi</p>', 'innerHTML', null, false, true);
    assert.equal(wrote, true);
    assert.equal(calls(), 1, 'startViewTransition should be invoked exactly once');
    assert.equal(target.innerHTML, '<p>hi</p>');
  } finally {
    delete globalThis.document.startViewTransition;
  }
});

test('swapContent: without forceTransition, startViewTransition is never called', async () => {
  const target = makeTarget();
  const calls = spyOnStartViewTransition();
  try {
    const wrote = await swapContent(target, '<p>hi</p>', 'innerHTML', null, false, false);
    assert.equal(wrote, true);
    assert.equal(calls(), 0, 'a plain swap must not route through the View Transition API');
    assert.equal(target.innerHTML, '<p>hi</p>');
  } finally {
    delete globalThis.document.startViewTransition;
  }
});

test('swapContent: forceTransition falls back to a plain swap when startViewTransition is unavailable', async () => {
  const target = makeTarget();
  delete globalThis.document.startViewTransition;
  const wrote = await swapContent(target, '<p>hi</p>', 'innerHTML', null, false, true);
  assert.equal(wrote, true);
  assert.equal(target.innerHTML, '<p>hi</p>');
});

test('swapContent: forceTransition composes with a non-innerHTML swap mode (outerHTML)', async () => {
  const target = makeTarget();
  const calls = spyOnStartViewTransition();
  try {
    const wrote = await swapContent(target, '<p>hi</p>', 'outerHTML', null, false, true);
    assert.equal(wrote, true);
    assert.equal(calls(), 1);
    assert.equal(target.outerHTML, '<p>hi</p>');
  } finally {
    delete globalThis.document.startViewTransition;
  }
});

test('swapContent: the legacy jst-swap="transition" alias still forces innerHTML through a View Transition', async () => {
  const target = makeTarget();
  const calls = spyOnStartViewTransition();
  try {
    const wrote = await swapContent(target, '<p>hi</p>', 'transition', null, false, false);
    assert.equal(wrote, true);
    assert.equal(calls(), 1);
    assert.equal(target.innerHTML, '<p>hi</p>');
  } finally {
    delete globalThis.document.startViewTransition;
  }
});

test('swapContent: a missed swap (no live target) still resolves false through the transition path', async () => {
  const target = makeTarget();
  target.isConnected = false;
  const calls = spyOnStartViewTransition();
  try {
    const wrote = await swapContent(target, '<p>hi</p>', 'innerHTML', null, false, true);
    assert.equal(wrote, false);
    assert.equal(calls(), 1, 'the API still runs; the update callback just finds no live target');
  } finally {
    delete globalThis.document.startViewTransition;
  }
});
