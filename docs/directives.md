# Directives — `jst-nav` & `jst-behaviors`

Two **opt-in** libraries of declarative attributes that live on your *usage* HTML
(not inside `<script type="jst">` templates). They're string-valued — URLs, CSS
selectors, trigger specs — never `$(…)` expressions, so they stay inside JST's
safe-by-default model. Each mirrors the core's scan + `MutationObserver` wiring,
so directives on server-rendered or swapped-in markup are wired automatically.

```html
<script type="module" src="jst-nav.js"></script>        <!-- server-driven nav -->
<script type="module" src="jst-behaviors.js"></script>  <!-- client behaviors -->
```

You load only what you use; both work with any core build (`jst.js` or the
precompiled `jst.runtime.js`). Minified `jst-nav.min.js` (~7.5 KB) and
`jst-behaviors.min.js` (~2.2 KB) ship for CDN/no-build use.

---

## `jst-nav` — server-driven navigation (HTMX/fixi-shaped)

Fetch → swap → history, declaratively.

| Directive | What it does |
| --- | --- |
| `jst-get="/url"` | GET + swap (shorthand) |
| `jst-action="/url"` + `method="post\|put\|patch\|delete"` | request URL + verb (reuses the **native** `method` attribute; GET if omitted) |
| `jst-target="<css>"` | where the response lands — **100% CSS selectors**: a bare selector, `this`, `closest <sel>`, `find <sel>`, `closest <sel> find <sel>`, or any `:scope` selector |
| `jst-swap="<how>"` | `innerHTML`(default) · `outerHTML` · `beforebegin`/`afterbegin`/`beforeend`/`afterend` · `delete` · `none` · `morph` · `transition` (View Transition API) |
| `jst-select="<css>"` | pull a subtree out of a full-page response |
| `jst-swap-oob` (in the response) | out-of-band: update other regions by `id`, separately from the main target |
| `jst-push-url[="/url"]` | push history (back/forward + restore on popstate) |
| `jst-boost` | on a container: boost descendant `<a>`/`<form>` into fetch+swap+push |
| `jst-confirm="msg"` | gate the request behind a confirm |
| `jst-trigger="<spec>"` | **when** it fires (below) |
| `jst-target-4xx` / `-5xx` / `-error` | route non-2xx responses elsewhere |

Lifecycle events bubble: `jst:before-request` (cancelable), `jst:after-request`,
`jst:swapped`, `jst:response-error`, `jst:send-error`. The triggering element
gets a `jst-request` class while in flight (a CSS hook for loading indicators).
In-flight requests **abort** when re-triggered (active-search correctness).

### `jst-trigger` specs

```
click | submit | change           (defaults: form→submit, input→change, else click)
load                              fire once on wire
revealed                          fire when scrolled into view (IntersectionObserver)
every 2s                          poll on an interval (stops when the element is removed)
keyup changed delay:300ms         debounced, only when the value changed
keydown[Shift+D] from:body        key-filtered (with modifiers), bound to another element
```

### Reverse infinite scroll (newest at the bottom, scroll up for older)

```html
<div id="log" style="overflow:auto; height:20rem">
  <div jst-get="/older?before=89" jst-trigger="revealed"
       jst-target="#log" jst-swap="afterbegin">… oldest loaded message …</div>
  … newer messages … (scrolled to the bottom)
</div>
```

`jst-swap="afterbegin"` prepends, and the scroll position is **preserved** so the
view doesn't jump. Each fetched batch carries the next `revealed` sentinel, which
`jst-nav` re-wires after the swap. (Forward infinite scroll is the same with
`jst-swap="beforeend"` and a bottom sentinel.) See `examples/jst_nav.html`.

---

## `jst-behaviors` — client behaviors (Alpine-shaped)

Only the bits the platform doesn't already give for free. (Toggle / dismiss /
outside-click / escape are native — Invoker Commands + Popover + `<dialog>` — so
they live in plain HTML, not here. See [`writing-jst.md`](./writing-jst.md) and
the component cross-section.)

| Directive | What it does |
| --- | --- |
| `jst-intersect[="once\|repeat"]` | on reveal: copy `data-src`→`src` (lazy media), add a `jst-revealed` class, fire a `jst:reveal` event |
| `jst-teleport="<css>\|body"` | move the element into a target (portal), escaping clipping/stacking ancestors |

See `examples/jst_behaviors.html`.

---

## When you need none of this

Most interactivity needs neither library — reach for the platform first:
open/close (`<dialog>` + `command`/`commandfor`), disclosure (`<details>`),
menus/tooltips (Popover API), responsive layout (container queries). The
directives are for the genuinely server-driven (nav) or
not-yet-native (intersect/teleport) cases.
