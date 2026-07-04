# Directives — `jst-nav` & `jst-behaviors`

Two **opt-in** libraries of declarative attributes that live on your *usage* HTML
(not inside `<script type="jst">` templates). They're string-valued — URLs, CSS
selectors, names — never `$(…)` expressions, so they stay inside JST's
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

## `jst-nav` — server-driven navigation

Every jst-nav element is a **cause → request → effect** sentence:

```
WHEN  <something happens>   →   DO  <a request>          →   PUT  <the response somewhere>
      the CAUSE                     jst-get / jst-action         jst-target / jst-swap
```

```html
<a jst-get="/page/2" jst-target="#list">next</a>
<!-- WHEN clicked (default cause) → GET /page/2 → put it in #list -->
```

All three parts are inert strings — URLs, CSS selectors, names — **never
executable expressions**. That's the injection barrier: server-rendered HTML can
declare requests but can never smuggle code, so jst-nav can't become a
CSP-bypass gadget.

### The cause — when the request fires

Most elements never declare one: the default is the element's natural event
(**form → submit, input/select/textarea → change, everything else → click**).
To override it, the cause is spelled the way HTML has always spelled causes —
in the attribute *name*:

| Cause | When the request fires |
| --- | --- |
| *(nothing)* | the default event above |
| `jst-on<event>` | on this DOM event instead (`jst-onmouseover`, `jst-onkeyup`, …) |
| `jst-on<event>="name"` | on this event, **gated/paced by the shaper** registered under that name (below) |
| `jst-load` | as soon as the element is wired |
| `jst-load="lazy"` | when scrolled into view (like the native `loading="lazy"`) |
| `jst-poll="2s"` | on an interval (`ms`/`s` units; stops when the element is removed) |

Multiple `jst-on<event>` attributes each wire their own cause; the presence of
any suppresses the default.

**Shapers** decide *whether/when* a given occurrence actually fires. A shaper is
a named JS function registered once per app — it receives `fire` ("do this
element's declared request now") and returns the event handler to install,
usually built from the same [handler combinators](writing-jst.md#shaping-when-a-handler-runs--combinators)
templates use:

```html
<input jst-get="/search" jst-target="#results" jst-oninput="typeahead" name="q">
```
```js
JST.nav.shape('typeahead', fire => changed(debounce(300, fire)))
```

The attribute value is an inert *name*, never code — the strict-CSP-safe
spelling of `oninput="typeahead(event)"`. A shaper can only gate or pace `fire`;
it has no way to change what firing does (the request and effect stay declared
on the HTML). An unknown name fails loud in the console, and a registration that
arrives later in page load heals it (script order is forgiven).

**Exotic causes** — global keyboard shortcuts, listening on another element —
don't need a feature. The element declares the request + effect; wire the cause
yourself with the platform:

```html
<span hidden id="palette" jst-get="/palette" jst-target="#cmd"></span>
<script type="module">
  import { keys } from './jst.js';
  import { request } from './jst-nav.js';
  document.body.addEventListener('keydown',
    keys({ 'Meta+k': () => request(document.getElementById('palette')) }));
</script>
```

**In templates, skip all of this.** A jst-nav element rendered by a template has
real JS available — wire the cause with a normal handler:
`oninput="$(changed(debounce(300, e => JST.nav.request(e.currentTarget))))"`.
`jst-on*` + shapers exist only for scriptless server-rendered HTML.

> **Migrating from `jst-trigger` (removed in v0.5.0)?** Every spec has one
> rewrite — see the [CHANGELOG migration table](../CHANGELOG.md). Quick guide:
> `keyup changed delay:300ms` → `jst-oninput="typeahead"` + a shaper;
> `revealed` → `jst-load="lazy"`; `load` → `jst-load`; `every 2s` →
> `jst-poll="2s"`; `[Key]` filters → `keys({...})` inside a shaper;
> `from:<css>` → `addEventListener` + `JST.nav.request(el)`; `once` →
> a once-gating shaper or `{ once: true }` in hand-wired listeners.

### The request + effect

| Directive | What it does |
| --- | --- |
| `jst-get="/url"` | GET + swap (shorthand) |
| `jst-action="/url"` + `method="post\|put\|patch\|delete"` | request URL + verb (reuses the **native** `method` attribute; GET if omitted) |
| `jst-target="<css>"` | where the response lands — **100% CSS selectors**: a bare selector, `this`, `closest <sel>`, `find <sel>`, `closest <sel> find <sel>`, or any `:scope` selector |
| `jst-swap="<how>"` | `innerHTML`(default) · `outerHTML` · `beforebegin`/`afterbegin`/`beforeend`/`afterend` · `delete` · `none` · `morph` · `transition` (View Transition API) |
| `jst-select="<css>"` | pull a subtree out of a full-page response |
| `jst-swap-oob` (in the response) | out-of-band: update other regions by `id`, separately from the main target |
| `jst-push-url[="/url"]` | push history (back/forward + restore on popstate) |
| `jst-replace-url[="/url"]` | **replace** the current history entry instead of pushing — filters / in-place changes that shouldn't add a back-button step (if both are set, replace wins) |
| `jst-boost` | on a container: boost descendant `<a>`/`<form>` into fetch+swap+push |
| `jst-confirm="msg"` | gate the request behind a confirm |
| `jst-target-4xx` / `-5xx` / `-error` | route non-2xx responses elsewhere |

> **New to View Transitions?** `jst-swap="transition"` wraps the swap in the
> browser's View Transition API — it animates the change from the old to the new
> DOM *for you* (a crossfade by default; customise with `::view-transition-*` CSS).
> See `examples/view_transitions.html` for a from-scratch, toggle-it-on/off demo.

### Request → swap lifecycle (and what's cancelable)

A request runs through this order; the bubbling events let you hook each stage:

```
jst:before-request   (cancelable — preventDefault() aborts before the fetch)
  → fetch (sends `JST-Request: true` + CSRF token; element gets the `jst-request` class)
  → jst:after-request
  → if !res.ok:  jst:response-error   (and routes to jst-target-4xx/5xx/error if set)
  → else:        jst-select → jst:before-swap (cancelable — drop a stale/wrong response)
                 → out-of-band swaps → swap → push/replace-url → jst:swapped → re-scan
```

**`jst:before-request`** and **`jst:before-swap`** are cancelable; the rest are
notifications. `jst:before-swap` fires once the response is read (after `jst-select`)
but *before* anything lands — `preventDefault()` drops the whole response (no swap, no
history, no `jst:swapped`). That's the hook for **request racing**: when two fast
navigations overlap and the slower-but-earlier response arrives last, a `before-swap`
listener can compare a nav token / target id and drop the stale one. `jst:swapped`
fires *after* the DOM is updated (it waits for a View-Transition's update callback),
and it's dispatched on a **connected** node so a delegated `document`-level listener
still receives it when an `outerHTML` swap detached the source element. In-flight requests
**abort** when the same element is re-triggered (active-search correctness). Event
details: `before-request` → `{ el, url, method }`; `after-request` →
`{ el, response, status }`; `before-swap` → `{ el, html, response }`; `swapped` →
`{ el, target }`; the error events → `{ el, response, status }`.

**CSRF.** Unsafe (non-`GET`) **same-origin** requests automatically carry the server's
CSRF token, read from `<meta name="csrf-token">` and sent as the `X-CSRF-Token` header
— the Rails / Laravel / Turbo convention, so a link doing a `POST` or a boosted click
stops tripping `InvalidAuthenticityToken`. It's same-origin-only (never leaked
cross-origin) and on by default. Remap it for another framework, or disable it:

```js
JST.nav.csrf.headerName = 'X-CSRFToken'   // e.g. Django
JST.nav.csrf.metaName   = ''              // disable entirely
```

**The `JST-Request: true` header** is on every `jst-nav` request — branch on it
server-side to render a *fragment* (the swap target's new HTML) instead of the full
page shell. (`jst-nav` is for **fragments**; for full-page navigation just use normal
browser links — see [hateoas-fragments.md](./hateoas-fragments.md). `jst-boost`
boosts links/forms whose responses are *fragments*, not whole documents.)

### Coming from `htmx.ajax()`? You don't need an imperative API

There's no `JST.nav.navigate(url, …)`, and that's deliberate. `htmx.ajax()` exists
because htmx can't *see* nodes you insert yourself — you'd have to call
`htmx.process(el)` to wire them up. JST runs a `MutationObserver`, so anything you
insert into a trusted root upgrades automatically. That means a programmatic
fetch-and-swap is already one line of plain platform code — no library wrapper:

```js
const html = await (await fetch('/orders/42/items', { method: 'POST', body }))
  .text()
document.getElementById('order-lines').insertAdjacentHTML('beforeend', html)
// done — new <order-line> components and any jst-* directives are already live
```

`fetch` does the request; the observer does the wiring. Reach for `jst-get` /
`jst-action` when you want the behaviour *declared on the HTML*; reach for `fetch`
when the cause is genuinely imperative. There's nothing in between to learn.

### Two spellings, one pattern (and the CSP toggle)

A named shaper is the same thing as a named handler — the difference is only
who evaluates the reference:

```html
oninput="typeahead(event)"     <!-- native inline handler: the BROWSER evaluates it; needs relaxed CSP -->
jst-oninput="typeahead"        <!-- inert name: jst-nav wires it; works under strict CSP -->
```

If your CSP allows inline handlers, the left column is plain platform code and
JST needs no feature at all. The right column is the same locality with nothing
executable in the markup. `jst-lint --csp` flags every native inline handler in
your HTML when you're ready to move to the strict column. What jst-nav will
never do is *evaluate* attribute values itself — that would re-open, via JST, the
exact hole a strict CSP closes.

### Reverse infinite scroll (newest at the bottom, scroll up for older)

```html
<div id="log" style="overflow:auto; height:20rem">
  <div jst-get="/older?before=89" jst-load="lazy"
       jst-target="#log" jst-swap="afterbegin">… oldest loaded message …</div>
  … newer messages … (scrolled to the bottom)
</div>
```

`jst-swap="afterbegin"` prepends, and the scroll position is **preserved** so the
view doesn't jump. Each fetched batch carries the next `jst-load="lazy"` sentinel,
which `jst-nav` re-wires after the swap. (Forward infinite scroll is the same with
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
