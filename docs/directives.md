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

> **New to View Transitions?** `jst-swap="transition"` wraps the swap in the
> browser's View Transition API — it animates the change from the old to the new
> DOM *for you* (a crossfade by default; customise with `::view-transition-*` CSS).
> See `examples/view_transitions.html` for a from-scratch, toggle-it-on/off demo.

### Request → swap lifecycle (and what's cancelable)

A request runs through this order; the bubbling events let you hook each stage:

```
jst:before-request   (cancelable — preventDefault() aborts before the fetch)
  → fetch (sends the `JST-Request: true` header; element gets the `jst-request` class)
  → jst:after-request
  → if !res.ok:  jst:response-error   (and routes to jst-target-4xx/5xx/error if set)
  → else:        jst-select → out-of-band swaps → swap → push-url → jst:swapped → re-scan
```

Only **`jst:before-request`** is cancelable. `jst:swapped` fires *after* the DOM is
updated (it waits for a View-Transition's update callback), and it's dispatched on
a **connected** node so a delegated `document`-level listener still receives it when
an `outerHTML` swap detached the trigger. In-flight requests **abort** when the same
element is re-triggered (active-search correctness). Event details: `before-request`
→ `{ el, url, method }`; `after-request` → `{ el, response, status }`; `swapped` →
`{ el, target }`; the error events → `{ el, response, status }`.

**The `JST-Request: true` header** is on every `jst-nav` request — branch on it
server-side to render a *fragment* (the swap target's new HTML) instead of the full
page shell. (`jst-nav` is for **fragments**; for full-page navigation just use normal
browser links — see [hateoas-fragments.md](./hateoas-fragments.md). `jst-boost`
boosts links/forms whose responses are *fragments*, not whole documents.)

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
