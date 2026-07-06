/*!
 * jst-behaviors — client behaviors for JST (opt-in, no build).
 * © Brent Jacobs · https://github.com/br3nt · https://github.com/br3nt/jst · MIT
 *
 * Alpine-shaped client behaviors that the platform doesn't already give for
 * free. (Toggle/dismiss/outside-click/escape are native now — Invoker Commands
 * + Popover + <dialog> — so they live in HTML, not here.) String-valued
 * directives on usage HTML; mirrors the jst.js scan + MutationObserver pattern.
 *
 *   <script type="module" src="jst-behaviors.js"></script>
 *
 *   jst-intersect[="once|repeat"]   on reveal: copy data-src→src (lazy media),
 *                                   add the `jst-revealed` class, fire jst:reveal
 *   jst-teleport="<css>|body"       move this element into the target (portal)
 *
 * Also defines <jst-include> — a component whose content lives at a URL:
 *
 *   <jst-include src="/banner"></jst-include>                 eager
 *   <jst-include src="/comments" when="visible"></jst-include> when scrolled into view
 *
 * A self-filling region is a COMPONENT with well-defined behaviour, not a div
 * wearing magic attributes — an inert element never gains behaviour from
 * jst-nav. Want polling, verbs, params, spinners? Write your own component;
 * this one is the pattern.
 */

const WIRED = Symbol('jstBehaviorsWired');

/* ----------------------------------------------------------------- teleport */

function teleport(el) {
  if (el[WIRED]) return;
  el[WIRED] = true;
  const sel = el.getAttribute('jst-teleport');
  const dest = sel === 'body' ? document.body : (sel ? document.querySelector(sel) : null);
  if (dest && dest !== el.parentNode) dest.appendChild(el);
}

/* ------------------------------------------------------------ intersect/reveal */

let io = null;

function reveal(el) {
  const src = el.getAttribute('data-src');
  if (src && 'src' in el) el.src = src;
  const srcset = el.getAttribute('data-srcset');
  if (srcset && 'srcset' in el) el.srcset = srcset;
  el.classList.add('jst-revealed');
  el.dispatchEvent(new CustomEvent('jst:reveal', { bubbles: true }));
}

function observeIntersect(el) {
  if (el[WIRED]) return;
  el[WIRED] = true;
  if (typeof IntersectionObserver === 'undefined') { reveal(el); return; }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        reveal(e.target);
        if (e.target.getAttribute('jst-intersect') !== 'repeat') io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px 100px 0px' });
  }
  io.observe(el);
}

/* -------------------------------------------------------------- jst-include */

// A region whose content is a URL — `src` for an HTML fragment, like <img src>.
// Eager by default; when="visible" defers the fetch until it scrolls into view
// (the same policy as native loading="lazy"). Fires jst:included after the
// fragment lands; the JST core observer upgrades any components inside it.
class JstInclude extends HTMLElement {
  static get observedAttributes() { return ['src']; }

  #loaded = false;
  #observer = null;

  connectedCallback() {
    if (this.getAttribute('when') === 'visible' && typeof IntersectionObserver !== 'undefined') {
      // Symmetric margin: an include the user scrolls PAST (now above the
      // viewport) must still load, not just one approaching from below.
      this.#observer = new IntersectionObserver((entries) => {
        if (!entries.some(e => e.isIntersecting)) return;
        this.#observer.disconnect();
        this.#observer = null;
        this.#load();
      }, { rootMargin: '200px 0px 200px 0px' });
      this.#observer.observe(this);
    } else {
      this.#load();
    }
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Changing src after the initial load re-fetches (a live region can be
    // repointed); before the first load it just informs the pending fetch.
    if (name === 'src' && this.#loaded && oldValue !== newValue) this.#load();
  }

  async #load() {
    const src = this.getAttribute('src');
    if (!src) return;
    let res;
    try {
      res = await fetch(src, { headers: { 'JST-Request': 'true' } });
    } catch (error) {
      this.dispatchEvent(new CustomEvent('jst:include-error', { bubbles: true, detail: { error } }));
      return;
    }
    if (!res.ok) {
      this.dispatchEvent(new CustomEvent('jst:include-error', { bubbles: true, detail: { response: res, status: res.status } }));
      return;
    }
    this.innerHTML = await res.text();
    this.#loaded = true;
    this.dispatchEvent(new CustomEvent('jst:included', { bubbles: true, detail: { src, response: res } }));
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('jst-include')) {
  customElements.define('jst-include', JstInclude);
}

/* ----------------------------------------------------------- scan + observe */

function scan(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (root.matches) {
    if (root.matches('[jst-teleport]')) teleport(root);
    if (root.matches('[jst-intersect]')) observeIntersect(root);
  }
  root.querySelectorAll('[jst-teleport]').forEach(teleport);
  root.querySelectorAll('[jst-intersect]').forEach(observeIntersect);
}

let observer = null;
function observe(root) {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
  });
  observer.observe(root, { childList: true, subtree: true });
}

/* --------------------------------------------------------------------- init */

export function configure(root = document) {
  scan(root.documentElement || root);
  observe(root.documentElement || root);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => configure(document));
  } else {
    configure(document);
  }
  (window.JST = window.JST || {}).behaviors = { configure, reveal };
}
