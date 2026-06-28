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
