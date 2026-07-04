/*!
 * jst-nav — declarative server-driven navigation for JST (opt-in, no build).
 * © Brent Jacobs · https://github.com/br3nt/jst · MIT
 *
 * Directives that live on USAGE HTML (not inside <script type="jst">
 * templates). Values are plain, inert strings — URLs, CSS selectors, names —
 * never executable expressions, so server-rendered HTML stays inside JST's
 * safe-by-default model (and jst-nav can never become a CSP-bypass gadget).
 *
 *   <script type="module" src="jst-nav.js"></script>
 *
 * Every element is a cause → request → effect sentence:
 *
 *   WHEN  (cause)   jst-on<event>[="shaper"] | jst-load[="lazy"] | jst-poll="2s"
 *                   default: form→submit, input/select/textarea→change, else click
 *   DO    (request) jst-get="/url" | jst-action="/url" + method="post|put|…"
 *   PUT   (effect)  jst-target="<css>" jst-swap="<how>" jst-select="<css>"
 *
 * Causes:
 *   jst-on<event>             fire the request on this DOM event instead of the default
 *   jst-on<event>="name"      …gated/paced by the SHAPER registered under that name:
 *                             JST.nav.shape('name', fire => handler). A shaper decides
 *                             WHEN to call fire (debounce, key filter, …); it can never
 *                             change what firing does. Unknown names fail loud.
 *   jst-load                  fire as soon as the element is wired
 *   jst-load="lazy"           fire when scrolled into view (like loading="lazy")
 *   jst-poll="2s"             fire on an interval (stops when the element is removed)
 *   Exotic causes (global shortcuts, listeners on other elements): wire them
 *   yourself — addEventListener + JST.nav.request(el). In templates skip all of
 *   this and use a normal handler: oninput="$(debounce(300, e => JST.nav.request(…)))".
 *
 * Request + effect:
 *   jst-get="/url"            GET + swap (shorthand)
 *   jst-action="/url"         request URL (pair with method= for the verb)
 *   method="post|put|…"       native attribute, reused as the verb (GET default)
 *   jst-target="<css>"        where the response lands (querySelector / closest / :scope / this)
 *   jst-swap="<how>"          innerHTML(default) outerHTML beforeend afterbegin
 *                             beforebegin afterend delete none morph transition
 *   jst-select="<css>"        pick a subtree out of the response
 *   jst-push-url[="/url"]     push history (back/forward + restore)
 *   jst-replace-url[="/url"]  replace the current history entry (filters/in-place)
 *   jst-boost                 on a container: boost descendant <a>/<form>
 *   jst-target-4xx/5xx/error  route error responses elsewhere
 *
 * Unsafe (non-GET) same-origin requests carry the server's CSRF token from
 * <meta name="csrf-token"> as X-CSRF-Token (configurable via JST.nav.csrf).
 *
 * Events (bubbling): jst:before-request, jst:after-request, jst:before-swap,
 * jst:swapped, jst:response-error, jst:send-error. before-request and
 * before-swap are cancelable (preventDefault()).
 */

const WIRED = Symbol('jstNavWired');
// [jst-trigger] is retained ONLY so leftover 0.4.x markup fails loud (see setupCauses).
const REQUESTABLE = '[jst-get],[jst-action],[jst-trigger]';

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

// Returns a promise that resolves once the DOM is updated (NOT once the animation
// finishes), so the caller can emit `swapped` / re-scan against the fresh DOM.
function swapContent(target, html, how) {
  if (!target) return Promise.resolve();
  how = (how || 'innerHTML').trim();
  let transition = false;
  if (how === 'transition') { transition = true; how = 'innerHTML'; }   // legacy alias

  const run = () => {
    switch (how) {
      case 'none': return;
      case 'delete': target.remove(); return;
      case 'outerHTML': target.outerHTML = html; return;
      case 'beforebegin': target.insertAdjacentHTML('beforebegin', html); return;
      case 'afterbegin': target.insertAdjacentHTML('afterbegin', html); return;
      case 'beforeend': target.insertAdjacentHTML('beforeend', html); return;
      case 'afterend': target.insertAdjacentHTML('afterend', html); return;
      case 'morph':
        if (window.JST && typeof window.JST.morph === 'function') { window.JST.morph(target, html); return; }
        target.innerHTML = html; return;   // fallback
      case 'innerHTML':
      default: target.innerHTML = html; return;
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
    catch { update(); return Promise.resolve(); }
    t.ready?.catch(() => {});
    t.finished?.catch(() => {});
    return (t.updateCallbackDone || Promise.resolve()).catch(() => {});
  }
  run();
  return Promise.resolve();
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

function requestParts(el) {
  const url = el.getAttribute('jst-get') || el.getAttribute('jst-action') ||
              el.getAttribute('href') || el.getAttribute('action') || '';
  const explicitGet = el.hasAttribute('jst-get');
  const method = (explicitGet ? 'GET'
    : (el.getAttribute('jst-method') || el.getAttribute('method') || 'GET')).toUpperCase();
  return { url, method };
}

export async function performRequest(el, sourceEvent) {
  let { url, method } = requestParts(el);
  if (!url) return;

  const confirmMsg = el.getAttribute('jst-confirm');
  if (confirmMsg && typeof window.confirm === 'function' && !window.confirm(confirmMsg)) return;

  const form = el.matches('form') ? el : el.closest('form');
  let body = null;
  // Collect params from the form, or — for a standalone named control (e.g. a
  // search input) — from the triggering element's own name/value, like htmx.
  const params = new URLSearchParams();
  if (form) {
    for (const [k, v] of new FormData(form)) params.append(k, v);
  } else if (el.name && 'value' in el) {
    params.append(el.name, el.value);
  }
  if (method === 'GET' || method === 'DELETE') {
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  } else {
    body = form ? new FormData(form) : params;
  }

  if (!emit(el, 'before-request', { el, url, method })) return; // cancelled

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
    if (err && err.name === 'AbortError') return;
    emit(el, 'send-error', { el, error: err });
    return;
  }

  let html = '';
  try { html = await res.text(); } catch {}
  el.classList.remove('jst-request');

  emit(el, 'after-request', { el, response: res, status: res.status });

  // Non-2xx: don't swap into the normal target by default; route if asked.
  if (!res.ok) {
    const errSel = el.getAttribute(`jst-target-${Math.floor(res.status / 100)}xx`) ||
                   el.getAttribute('jst-target-error');
    emit(el, 'response-error', { el, response: res, status: res.status });
    if (!errSel) return;
    const errTarget = resolveTarget(el, errSel);
    swapContent(errTarget, html, 'innerHTML');
    return;
  }

  const select = el.getAttribute('jst-select');
  if (select) html = selectFrom(html, select);

  // Cancelable hand-off between "response read" and "swap applied" (#47): a
  // listener can preventDefault() to DROP a response that's been superseded or is
  // for the wrong target (race correctness — two fast navigations, slow first
  // response). Cancelling skips OOB, the swap, the history push, and jst:swapped.
  if (!emit(el, 'before-swap', { el, html, response: res })) return;

  // Out-of-band swaps: elements in the response marked jst-swap-oob are swapped
  // into their id-matched targets elsewhere, then dropped from the main content.
  html = applyOob(html);

  const how = el.getAttribute('jst-swap') || 'innerHTML';
  const target = how === 'none' ? null : resolveTarget(el, el.getAttribute('jst-target'));
  // Capture the parent now: an outerHTML/delete swap detaches `target`, but the
  // new content lands in this parent — we still need to re-scan it afterwards.
  const targetParent = target ? target.parentNode : null;
  if (target) {
    // Preserve scroll position when prepending above the viewport (reverse scroll).
    const scroller = how === 'afterbegin' ? scrollParent(target) : null;
    const prevHeight = scroller ? scroller.scrollHeight : 0;
    const prevTop = scroller ? scroller.scrollTop : 0;
    await swapContent(target, html, how);   // resolves after the DOM updates (#48A)
    if (scroller) scroller.scrollTop = prevTop + (scroller.scrollHeight - prevHeight);
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

  // Emit on a connected node: an outerHTML swap on an ancestor detaches `el`, and
  // a `swapped` dispatched on a detached node never bubbles to a delegated
  // document-level listener (#48B). `detail.el` still identifies the source.
  emit(el.isConnected ? el : document, 'swapped', { el, target });
  // Re-scan the region that changed (the captured parent survives a detach).
  scan((target && target.parentNode) || targetParent || document);
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

/* ------------------------------------------------------------------- causes */

// Shapers: named JS functions referenced (inertly) from jst-on<event>="name".
// A shaper receives `fire` — "do this element's declared request now" — and
// returns the event handler to install. It gates or paces fire; it has no way
// to change what firing does (the request + effect stay declared on the HTML).
const shapers = {};
// Elements whose named shaper wasn't registered yet at wire time: healed by
// shape() when the registration arrives (script-order forgiveness), and the
// console.error below stays visible if it never does.
const pendingShapes = [];

export function shape(name, shaper) {
  shapers[name] = shaper;
  for (let i = pendingShapes.length - 1; i >= 0; i--) {
    if (pendingShapes[i].name !== name) continue;
    const { el, event } = pendingShapes.splice(i, 1)[0];
    if (el.isConnected) attachCause(el, event, shaper);
  }
}

function ms(s) {
  const m = /^([\d.]+)(ms|s)?$/.exec((s || '').trim());
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1);
}

let revealObserver = null;
function observeReveal(el) {
  if (typeof IntersectionObserver === 'undefined') { performRequest(el); return; }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const node = e.target;
          revealObserver.unobserve(node);
          performRequest(node);
        }
      });
    }, { rootMargin: '0px 0px 200px 0px' });
  }
  revealObserver.observe(el);
}

function attachCause(el, event, shaper) {
  const fire = (ev) => performRequest(el, ev);
  let handler = fire;
  if (shaper) {
    handler = shaper(fire);
    if (typeof handler !== 'function') {
      console.error(`JST nav: shaper for jst-on${event} on <${el.tagName.toLowerCase()}> did not return a handler function. A shaper is fire => handler, e.g. JST.nav.shape('typeahead', fire => changed(debounce(300, fire))).`);
      return;
    }
  }
  el.addEventListener(event, (ev) => {
    // Keep the browser's default navigation/submit out of the way synchronously,
    // even when the shaper defers the actual firing (debounce et al.).
    if (event === 'submit' || el.matches('a')) ev.preventDefault();
    handler(ev);
  });
}

function wireCause(el, event, shaperName) {
  if (!shaperName) { attachCause(el, event, null); return; }
  const shaper = shapers[shaperName];
  if (!shaper) {
    const pending = { el, event, name: shaperName };
    pendingShapes.push(pending);
    // jst-nav usually evaluates before the app module that registers the shaper
    // (it scans immediately, while import graphs are still fetching), so give
    // same-page-load registrations until window load before failing loud.
    const report = () => {
      if (!pendingShapes.includes(pending)) return;   // healed by shape()
      console.error(`JST nav: unknown shaper "${shaperName}" in jst-on${event} on <${el.tagName.toLowerCase()}>. Register it — JST.nav.shape('${shaperName}', fire => handler) — the element stays unwired until then.`);
    };
    if (document.readyState === 'complete') setTimeout(report, 0);
    else window.addEventListener('load', () => setTimeout(report, 0), { once: true });
    return;
  }
  attachCause(el, event, shaper);
}

function defaultCause(el) {
  if (el.matches('form')) return 'submit';
  if (el.matches('input,select,textarea')) return 'change';
  return 'click';
}

function setupCauses(el) {
  if (el.hasAttribute('jst-trigger')) {
    console.error(`JST nav: jst-trigger was removed in v0.5.0 (value ${JSON.stringify(el.getAttribute('jst-trigger'))}). Declare the cause with jst-on<event>[="shaper"], jst-load[="lazy"], or jst-poll="2s" — see the CHANGELOG migration table. Falling back to the default cause.`);
  }

  let wired = false;
  for (const name of el.getAttributeNames()) {
    if (!name.startsWith('jst-on') || name.length <= 'jst-on'.length) continue;
    wireCause(el, name.slice('jst-on'.length), el.getAttribute(name) || null);
    wired = true;
  }
  if (el.hasAttribute('jst-load')) {
    if (el.getAttribute('jst-load') === 'lazy') observeReveal(el);
    else performRequest(el);
    wired = true;
  }
  const poll = el.getAttribute('jst-poll');
  if (poll !== null) {
    const id = setInterval(() => { if (el.isConnected) performRequest(el); else clearInterval(id); }, ms(poll) || 1000);
    wired = true;
  }
  if (!wired) attachCause(el, defaultCause(el), null);
}

/* -------------------------------------------------------------------- boost */

function wireBoost(container) {
  if (container[WIRED]) return;
  container[WIRED] = true;
  container.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !container.contains(a)) return;
    if (a.hasAttribute('jst-get') || a.hasAttribute('jst-action')) return; // handled directly
    if (a.target === '_blank' || a.getAttribute('jst-boost') === 'false') return;
    if (a.origin && a.origin !== location.origin) return;
    e.preventDefault();
    const proxy = a;
    proxy.setAttribute('jst-get', a.getAttribute('href'));
    if (!proxy.getAttribute('jst-target')) proxy.setAttribute('jst-target', container.getAttribute('jst-target') || 'body');
    if (proxy.getAttribute('jst-push-url') === null) proxy.setAttribute('jst-push-url', a.getAttribute('href'));
    performRequest(proxy);
  });
}

/* ----------------------------------------------------------- scan + observe */

function wire(el) {
  if (el[WIRED]) return;
  el[WIRED] = true;
  setupCauses(el);
}

function scan(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (root.matches && root.matches(REQUESTABLE)) wire(root);
  root.querySelectorAll(REQUESTABLE).forEach(wire);
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
  proxy.setAttribute('jst-get', location.pathname + location.search);
  proxy.setAttribute('jst-target', boost.getAttribute('jst-target') || 'body');
  performRequest(proxy);
}

/* --------------------------------------------------------------------- init */

export { performRequest as request };

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
  (window.JST = window.JST || {}).nav = {
    configure,
    request: performRequest,   // blessed name: fire an element's declared request now
    performRequest,            // 0.4.x alias
    shape,
    csrf,
  };
}
