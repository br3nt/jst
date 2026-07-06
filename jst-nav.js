/*!
 * jst-nav — declarative server-driven navigation for JST (opt-in, no build).
 * © Brent Jacobs · https://github.com/br3nt/jst · MIT
 *
 * ENHANCEMENT ONLY (v0.6.0): jst-nav upgrades elements that already act — a
 * link navigates, a form submits — so their native action fetches a fragment
 * and swaps it in instead of loading a whole page. It never invents behaviour
 * on inert elements (that's a component's job — see <jst-include> in
 * jst-behaviors.js) and never evaluates attribute strings (values are inert
 * URLs/CSS selectors, so server HTML can't smuggle code — no script gadget).
 *
 *   <script type="module" src="jst-nav.js"></script>
 *
 *   <a href="/page/2" jst-target="#list">next</a>
 *   <form action="/orders" method="post" jst-target="#list">…</form>
 *
 * The URL and verb come from the element's NATIVE attributes (href / action /
 * method). The presence of any jst-nav effect attribute opts the element in;
 * it fires on the element's native activation (link click, form submit) and
 * degrades to normal navigation with JS off.
 *
 * Effect attributes (on <a> and <form>):
 *   jst-target="<css>"        where the response lands (querySelector / closest / :scope / this)
 *   jst-swap="<how>"          innerHTML(default) outerHTML beforeend afterbegin
 *                             beforebegin afterend delete none morph transition
 *   jst-select="<css>"        pick a subtree out of the response
 *   jst-push-url[="/url"]     push history (back/forward + restore)
 *   jst-replace-url[="/url"]  replace the current history entry (filters/in-place)
 *   jst-confirm="msg"         gate the request behind a confirm
 *   jst-target-4xx/5xx/error  route error responses elsewhere
 *   jst-boost                 on a container: boost every descendant <a>/<form>
 *
 * The imperative primitive (same pipeline, callable from any handler):
 *   import { swap } from './jst-nav.js';
 *   swap('#results', '/search?q=' + this.value);
 *   swap('#list', '/orders', { method: 'POST', body });
 *
 * Unsafe (non-GET) same-origin requests carry the server's CSRF token from
 * <meta name="csrf-token"> as X-CSRF-Token (configurable via JST.nav.csrf).
 *
 * Events (bubbling): jst:before-request, jst:after-request, jst:before-swap,
 * jst:swapped, jst:swap-missed, jst:response-error, jst:send-error. before-request and
 * before-swap are cancelable (preventDefault()).
 */

const WIRED = Symbol('jstNavWired');

// Enhancement is opt-in per element: any effect attribute on a link or form.
const NAV_ATTRS = ['jst-target', 'jst-swap', 'jst-select', 'jst-push-url', 'jst-replace-url', 'jst-confirm'];
const ENHANCEABLE = NAV_ATTRS.flatMap(attr => [`a[${attr}]`, `form[${attr}]`]).join(',');
// Removed-in-v0.6.0 attributes: detected only to fail loud with the rewrite.
const LEGACY = '[jst-get],[jst-action],[jst-trigger],[jst-load],[jst-poll]';

/* ------------------------------------------------------------------ targets */

// Resolve a jst-target value to an element. 100% CSS selectors: `this`, a bare
// selector (document-wide), `closest <sel>`, `find <sel>` (descendant), or any
// selector with :scope resolved from `el`.
function resolveTarget(el, raw) {
  if (!raw || raw === 'this') return el;
  const value = raw.trim();
  if (value.startsWith('closest ')) {
    const rest = value.slice(8).trim();
    const at = rest.indexOf(' find ');
    if (at !== -1) {
      const anc = el.closest(rest.slice(0, at).trim());
      return anc ? anc.querySelector(rest.slice(at + 6).trim()) : null;
    }
    return el.closest(rest);
  }
  if (value.startsWith('find ')) return el.querySelector(value.slice(5).trim());
  if (value.includes(':scope')) return el.querySelector(value);
  return document.querySelector(value);
}

/* -------------------------------------------------------------------- swaps */

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Returns a promise resolving to true once the DOM is updated (NOT once the
// animation finishes) — or FALSE when the write found no target, so the caller
// can report the miss instead of silently succeeding (#57).
function swapContent(target, html, how, reresolve) {
  how = (how || 'innerHTML').trim();
  let transition = false;
  if (how === 'transition') { transition = true; how = 'innerHTML'; }   // legacy alias

  // The target is re-resolved at WRITE time: with a View Transition the write
  // runs inside an async update callback, and an overlapping swap may have
  // replaced or detached the node resolved at response time — outerHTML on a
  // parentless node is a silent spec no-op (#57). A fresh, connected match
  // wins; a still-connected original is kept; nothing is a miss.
  const liveTarget = () => {
    const fresh = reresolve ? reresolve() : null;
    if (fresh && fresh.isConnected) return fresh;
    return target && target.isConnected ? target : null;
  };

  let swapped = false;
  const run = () => {
    const t = liveTarget();
    if (!t) return;
    swapped = true;
    switch (how) {
      case 'none': return;
      case 'delete': t.remove(); return;
      case 'outerHTML': t.outerHTML = html; return;
      case 'beforebegin': t.insertAdjacentHTML('beforebegin', html); return;
      case 'afterbegin': t.insertAdjacentHTML('afterbegin', html); return;
      case 'beforeend': t.insertAdjacentHTML('beforeend', html); return;
      case 'afterend': t.insertAdjacentHTML('afterend', html); return;
      case 'morph':
        if (window.JST && typeof window.JST.morph === 'function') { window.JST.morph(t, html); return; }
        t.innerHTML = html; return;   // fallback
      case 'innerHTML':
      default: t.innerHTML = html; return;
    }
  };

  // Animate with a View Transition when asked AND possible. A hidden document,
  // reduced-motion, no API, or an abort all degrade quietly to an instant swap —
  // no unhandled rejection (#43). The returned promise resolves when the DOM is
  // updated, not when the animation ends (#48A).
  if (transition && typeof document.startViewTransition === 'function'
      && document.visibilityState !== 'hidden' && !reducedMotion()) {
    let ran = false;
    const update = () => { if (!ran) { ran = true; run(); } };
    let t;
    try { t = document.startViewTransition(update); }
    catch { update(); return Promise.resolve(swapped); }
    t.ready?.catch(() => {});
    t.finished?.catch(() => {});
    return (t.updateCallbackDone || Promise.resolve()).catch(() => {}).then(() => swapped);
  }
  run();
  return Promise.resolve(swapped);
}

// Pull a subtree out of a full-page (or fragment) response.
function selectFrom(html, selector) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const node = doc.querySelector(selector);
  return node ? node.outerHTML : '';
}

// Out-of-band swaps: pull every [jst-swap-oob] element out of the response and
// swap it into the element with the matching id, then return the remaining HTML
// for the normal swap. jst-swap-oob="true|outerHTML"(default) | innerHTML | beforeend.
function applyOob(html) {
  if (!html || html.indexOf('jst-swap-oob') === -1) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('[jst-swap-oob]').forEach((node) => {
    const mode = node.getAttribute('jst-swap-oob');
    const dest = node.id ? document.getElementById(node.id) : null;
    node.removeAttribute('jst-swap-oob');
    node.remove();   // detach from the parsed doc FIRST (so it's out of the main html)
    if (!dest) return;
    if (mode === 'innerHTML') dest.innerHTML = node.innerHTML;
    else if (mode === 'beforeend') dest.insertAdjacentHTML('beforeend', node.outerHTML);
    else dest.replaceWith(node);   // node is detached; this inserts it live
  });
  return doc.body.innerHTML;
}

/* ----------------------------------------------------------------- requests */

function emit(el, name, detail) {
  return el.dispatchEvent(new CustomEvent('jst:' + name, { detail, bubbles: true, cancelable: true }));
}

// Dispatch from a connected node: an event dispatched on a detached element
// never bubbles, so document-level delegated listeners miss it (#48B, and the
// #57 sibling gap for the mid-pipeline events). detail.el still identifies
// the source element.
function emitConnected(el, name, detail) {
  return emit(el && el.isConnected ? el : document, name, detail);
}

// CSRF: mirror the server's <meta name="csrf-token"> as a header on unsafe
// (non-GET) same-origin requests — the Rails/Laravel/Turbo convention, so the
// non-form directive paths (a link doing a POST, a boosted click) stop hitting
// InvalidAuthenticityToken. Tweak for other frameworks (Django:
// `JST.nav.csrf.headerName = 'X-CSRFToken'`) or disable (`JST.nav.csrf.metaName = ''`).
const csrf = { metaName: 'csrf-token', headerName: 'X-CSRF-Token' };

function sameOrigin(url) {
  try { return new URL(url, location.href).origin === location.origin; }
  catch { return true; }   // relative/opaque — treat as same-origin
}

function buildHeaders(method, url) {
  const headers = { 'JST-Request': 'true' };
  if (method !== 'GET' && method !== 'HEAD' && csrf.metaName && csrf.headerName && sameOrigin(url)) {
    const meta = document.querySelector(`meta[name="${csrf.metaName}"]`);
    const token = meta && meta.getAttribute('content');
    if (token) headers[csrf.headerName] = token;
  }
  return headers;
}

// The URL and verb come from the element's NATIVE attributes: href (links),
// action + method (forms; `method` is also honoured on links for non-GET
// actions expressed as anchors).
function requestParts(el) {
  const url = el.getAttribute('href') || el.getAttribute('action') || '';
  const method = (el.getAttribute('method') || 'GET').toUpperCase();
  return { url, method };
}

async function performRequest(el, sourceEvent) {
  let { url, method } = requestParts(el);
  if (!url) return null;

  const confirmMsg = el.getAttribute('jst-confirm');
  if (confirmMsg && typeof window.confirm === 'function' && !window.confirm(confirmMsg)) return null;

  const form = el.matches('form') ? el : el.closest('form');
  let body = null;
  const params = new URLSearchParams();
  if (form) {
    for (const [k, v] of new FormData(form)) params.append(k, v);
  }
  if (method === 'GET' || method === 'DELETE') {
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  } else {
    body = form ? new FormData(form) : params;
  }

  if (!emit(el, 'before-request', { el, url, method })) return null; // cancelled

  // Abort any in-flight request from this element so a slow earlier response
  // can't overwrite a newer one (active-search correctness).
  if (el.__jstAbort) el.__jstAbort.abort();
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  el.__jstAbort = ac;

  el.classList.add('jst-request');   // loading indicator hook (hx-indicator)
  let res;
  try {
    res = await fetch(url, { method, body, signal: ac ? ac.signal : undefined, headers: buildHeaders(method, url) });
  } catch (err) {
    el.classList.remove('jst-request');
    if (err && err.name === 'AbortError') return null;
    emitConnected(el, 'send-error', { el, error: err });
    return null;
  }

  let html = '';
  try { html = await res.text(); } catch {}
  el.classList.remove('jst-request');

  emitConnected(el, 'after-request', { el, response: res, status: res.status });

  // Non-2xx: don't swap into the normal target by default; route if asked.
  if (!res.ok) {
    const errSel = el.getAttribute(`jst-target-${Math.floor(res.status / 100)}xx`) ||
                   el.getAttribute('jst-target-error');
    emitConnected(el, 'response-error', { el, response: res, status: res.status });
    if (!errSel) return res;
    const errTarget = resolveTarget(el, errSel);
    swapContent(errTarget, html, 'innerHTML');
    return res;
  }

  const select = el.getAttribute('jst-select');
  if (select) html = selectFrom(html, select);

  // Cancelable hand-off between "response read" and "swap applied" (#47): a
  // listener can preventDefault() to DROP a response that's been superseded or is
  // for the wrong target (race correctness — two fast navigations, slow first
  // response). Cancelling skips OOB, the swap, the history push, and jst:swapped.
  if (!emitConnected(el, 'before-swap', { el, html, response: res })) return res;

  // Out-of-band swaps: elements in the response marked jst-swap-oob are swapped
  // into their id-matched targets elsewhere, then dropped from the main content.
  html = applyOob(html);

  const how = el.getAttribute('jst-swap') || 'innerHTML';
  const targetSel = el.getAttribute('jst-target');
  const target = how === 'none' ? null : resolveTarget(el, targetSel);
  // Capture the parent now: an outerHTML/delete swap detaches `target`, but the
  // new content lands in this parent — we still need to re-scan it afterwards.
  const targetParent = target ? target.parentNode : null;
  let missed = false;
  if (how !== 'none') {
    if (target) {
      // Preserve scroll position when prepending above the viewport (reverse scroll).
      const scroller = how === 'afterbegin' ? scrollParent(target) : null;
      const prevHeight = scroller ? scroller.scrollHeight : 0;
      const prevTop = scroller ? scroller.scrollTop : 0;
      // Re-resolve at write time (#57): an overlapping swap can detach the
      // node captured above before a View Transition's update callback runs.
      const wrote = await swapContent(target, html, how, () => resolveTarget(el, targetSel));
      missed = !wrote;
      if (scroller) scroller.scrollTop = prevTop + (scroller.scrollHeight - prevHeight);
    } else {
      missed = true;
    }
  }

  // A missed swap is a detectable failure, not a silent success: no history
  // entry, no jst:swapped — a bubbling jst:swap-missed instead (#57).
  if (missed) {
    emitConnected(el, 'swap-missed', { el, url, target: targetSel });
    return res;
  }

  // History (GET navigations). jst-replace-url replaces the current entry
  // (filters / in-place changes), jst-push-url adds one (back/forward); if both
  // are present, replace wins. Value optional — defaults to the request URL.
  if (method === 'GET') {
    const replace = el.getAttribute('jst-replace-url');
    const push = el.getAttribute('jst-push-url');
    if (replace !== null) history.replaceState({ jstNav: true }, '', replace || url);
    else if (push !== null) history.pushState({ jstNav: true }, '', push || url);
  }

  emitConnected(el, 'swapped', { el, target });
  // Re-scan the region that changed (the captured parent survives a detach).
  scan((target && target.parentNode) || targetParent || document);
  return res;
}

function scrollParent(node) {
  let el = node && node.parentElement;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/* ------------------------------------------------------------ enhancement */

// Upgrade a link/form so its NATIVE activation fetches a fragment instead of
// loading a page. That's the entire trigger model: links fire on click, forms
// on submit. Anything else — reveal, polling, keystrokes, websockets — is a
// handler or a component calling swap(), not a jst-nav attribute.
function enhance(el) {
  const event = el.matches('form') ? 'submit' : 'click';
  el.addEventListener(event, (ev) => {
    if (ev.defaultPrevented) return;   // someone else claimed this activation
    ev.preventDefault();
    performRequest(el, ev);
  });
}

// Removed-in-v0.6.0 attributes fail loud with the rewrite instead of silently
// doing nothing.
function reportLegacyAttributes(el) {
  const legacy = el.getAttributeNames().filter(name =>
    name === 'jst-get' || name === 'jst-action' || name === 'jst-trigger'
    || name === 'jst-load' || name === 'jst-poll' || name.startsWith('jst-on'));
  if (!legacy.length) return;
  console.error(`JST nav: ${legacy.map(n => `${n}=`).join(' ')} removed in v0.6.0. jst-nav enhances links and forms only (native href/action/method + jst-target/jst-swap). Self-filling regions → <jst-include src="…"> (jst-behaviors.js); polling/reveal/keystroke causes → a handler or component calling swap(). See the CHANGELOG migration table.`, el);
}

/* -------------------------------------------------------------------- boost */

function wireBoost(container) {
  if (container[WIRED]) return;
  container[WIRED] = true;
  container.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !container.contains(a)) return;
    if (a.matches(ENHANCEABLE)) return;   // enhanced directly
    if (a.target === '_blank' || a.getAttribute('jst-boost') === 'false') return;
    if (a.origin && a.origin !== location.origin) return;
    e.preventDefault();
    // The anchor already carries its URL natively (href); give it the
    // container's effect defaults and run the shared pipeline.
    if (!a.getAttribute('jst-target')) a.setAttribute('jst-target', container.getAttribute('jst-target') || 'body');
    if (a.getAttribute('jst-push-url') === null) a.setAttribute('jst-push-url', a.getAttribute('href'));
    performRequest(a);
  });
}

/* ----------------------------------------------------------- scan + observe */

function wire(el) {
  if (el[WIRED]) return;
  el[WIRED] = true;
  enhance(el);
}

const legacyReported = new WeakSet();
function warnLegacy(el) {
  if (legacyReported.has(el)) return;
  legacyReported.add(el);
  reportLegacyAttributes(el);
}

function scan(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (root.matches && root.matches(ENHANCEABLE)) wire(root);
  root.querySelectorAll(ENHANCEABLE).forEach(wire);
  if (root.matches && root.matches(LEGACY)) warnLegacy(root);
  root.querySelectorAll(LEGACY).forEach(warnLegacy);
  if (root.matches && root.matches('[jst-boost]')) wireBoost(root);
  root.querySelectorAll('[jst-boost]').forEach(wireBoost);
}

let observer = null;
function observe(root) {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

function onPopState() {
  // Minimal restore: re-fetch the current URL into the boosted target.
  const boost = document.querySelector('[jst-boost]');
  if (!boost) return;
  const proxy = document.createElement('a');
  proxy.setAttribute('href', location.pathname + location.search);
  proxy.setAttribute('jst-target', boost.getAttribute('jst-target') || 'body');
  performRequest(proxy);
}

/* --------------------------------------------------------------------- init */

/* ---------------------------------------------------------------- swap() */

/**
 * The imperative primitive: fetch `url` and swap the response into `target`.
 * Same pipeline as the declarative attributes (JST-Request + CSRF headers,
 * jst-select via options.select, out-of-band swaps, re-scan) minus the
 * element-centric parts (events, history) — you're in JS; compose those
 * yourself. `target` is an Element or CSS selector; `options` is fetch init
 * plus { swap: '<how>', select: '<css>' }. Returns the Response.
 *
 *   oninput="if (changed(event)) debounce(event, 300, () => swap('#results', '/search?q=' + this.value))"
 */
export async function swap(target, url, options = {}) {
  const { swap: how = 'innerHTML', select = null, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const headers = { ...buildHeaders(method, url), ...(init.headers || {}) };
  const res = await fetch(url, { ...init, method, headers });
  let html = '';
  try { html = await res.text(); } catch {}
  if (!res.ok) return res;
  if (select) html = selectFrom(html, select);
  html = applyOob(html);
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  const parent = element ? element.parentNode : null;
  // String targets re-resolve at write time (#57); a miss emits a bubbling
  // jst:swap-missed from document instead of succeeding silently.
  const reresolve = typeof target === 'string' ? () => document.querySelector(target) : null;
  const wrote = await swapContent(element, html, how, reresolve);
  if (!wrote && how !== 'none') {
    emit(document, 'swap-missed', { url, target: typeof target === 'string' ? target : null });
    return res;
  }
  scan((element && element.parentNode) || parent || document);
  return res;
}

/**
 * Programmatic navigation with the FULL enhanced-element pipeline — the parts
 * swap() deliberately omits: the bubbling lifecycle events
 * (jst:before-request, jst:after-request, cancelable jst:before-swap,
 * jst:swapped, jst:swap-missed, jst:response-error), confirm, select, and
 * history. Runs against a library-owned driver anchor appended for the
 * duration, so document-level delegated listeners see exactly what a clicked
 * link produces (#58, #60). Returns the Response, or null when cancelled.
 *
 *   navigate('/orders?tag=x', { target: '#mainview', swap: 'outerHTML', replaceUrl: true });
 *
 * options: target (CSS selector), swap, select, confirm, method,
 * pushUrl / replaceUrl (true = the request URL, or an explicit URL string),
 * dataset ({ navMode: 'push', … } → data-* on the driver for listeners to read).
 */
export async function navigate(url, options = {}) {
  const driver = document.createElement('a');
  driver.setAttribute('href', url);
  if (options.target) driver.setAttribute('jst-target', options.target);
  if (options.swap) driver.setAttribute('jst-swap', options.swap);
  if (options.select) driver.setAttribute('jst-select', options.select);
  if (options.confirm) driver.setAttribute('jst-confirm', options.confirm);
  if (options.method) driver.setAttribute('method', options.method);
  if (options.pushUrl) driver.setAttribute('jst-push-url', options.pushUrl === true ? '' : options.pushUrl);
  if (options.replaceUrl) driver.setAttribute('jst-replace-url', options.replaceUrl === true ? '' : options.replaceUrl);
  for (const [key, value] of Object.entries(options.dataset || {})) driver.dataset[key] = value;
  driver.hidden = true;
  document.body.appendChild(driver);
  try {
    return await performRequest(driver);
  } finally {
    driver.remove();
  }
}

export function configure(root = document) {
  scan(root.documentElement || root);
  observe(root.documentElement || root);
}

if (typeof document !== 'undefined') {
  window.addEventListener('popstate', onPopState);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => configure(document));
  } else {
    configure(document);
  }
  (window.JST = window.JST || {}).nav = { configure, swap, navigate, csrf };
}
