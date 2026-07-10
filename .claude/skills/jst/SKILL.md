---
name: jst
description: Author and edit JST components - reactive web components written in plain HTML with JavaScript as the templating language, no build step. Use when writing or changing a `<script type="jst">` component, wiring server-driven navigation with jst-nav (jst-target/jst-swap/jst-select/morph), styling a page with the jst-layout tokens or layout primitives (jst-stack, jst-cluster, jst-grid, ...) and jst-components patterns, or debugging why a JST page renders wrong, loses focus/state across a swap, or fails to escape output.
---

# JST - authoring and editing components

JST turns a `<script type="jst" name="x-y">` tag into a real custom element via
`customElements.define()`, so every component is inspectable in DevTools and
scriptable with plain properties and `addEventListener`. JavaScript itself is the
template language (`$(expr)`, `$ if`, `$ forEach`), there is no build step, and a
server can emit the same HTML that defines and uses a component. Reach for this
skill when authoring or editing a JST component, wiring `jst-nav`, styling with
`jst-layout` / `jst-components`, or debugging a JST page.

Repo references: `README.md`, `docs/index.html` (walkthrough), `index.d.ts` +
`jst-nav.d.ts` (API surface), `CHANGELOG.md` (per-release semantics and migrations).

## How JST is consumed: vendored, not packaged

JST is copied into an app as files (or loaded from a pinned CDN tag), not installed
from npm. Name each distributable by its job:

- `jst.js` - module runtime plus in-browser compiler (`new Function`). Dev,
  prototypes, server-streamed trusted components. Exposes `morph`.
- `jst.runtime.js` - runtime only, compiler dropped (~40% smaller). Pair with
  precompiled templates for strict CSP (no `unsafe-eval`).
- `jst.global.js` / `jst.runtime.global.js` - the same two as one classic
  (non-module) script exposing `window.JST`; run from `file://` with no server.
- `jst-nav.js` - opt-in server-driven navigation: upgrades links/forms that already
  act so their action fetches a fragment. Exports `swap`, `navigate`, `configure`.
- `jst-behaviors.js` - `<jst-include src=...>` (fetch a fragment, eager or
  `when="visible"`) and the `onreveal` synthetic event plumbing.
- `jst-layout.css` - tokens, classless base, layout primitives (zero JavaScript).
- `jst-components.css` + `jst-components.html` - component skins and the JST
  component definitions (`jst-palette`, `jst-tabs`, `jst-toaster`, `jst-combobox`,
  `jst-table`).
- Minified twins (`*.min.js`, `*.min.css`) sit next to each source. `tools/`:
  `precompile.mjs` (CSP module), `lint.mjs` + `codemod.mjs` (find/rewrite stale syntax).

## Authoring a component

```html
<script type="jst" name="todo-item" attributes="item">
  <li jst-key="$(item.id)">
    <button onclick="event.stopPropagation(); el.emit('toggle', item)">Done</button>
    $(item.text)
  </li>
</script>
```

- The `name` becomes the tag (custom element names must contain a hyphen).
- `attributes="item"` (space-separated, case-preserving) declares values usable as
  variables in the template and as properties on the element (`el.item`). External
  HTML uses platform casing, so multi-word call sites are kebab-case: `on-toggle`
  maps to the `onToggle` property.
- Plain attributes carry JSON, so a server renders data straight into the tag:
  `count="1"`, `open="true"`, `items='[{"id":1}]'`.
- `el` is the host element. `el.emit(name, detail)` dispatches a `CustomEvent` (up).
- `jst-key="$(id)"` preserves DOM identity across list inserts, removes, reorders.
- `jst-model="title"` is local form sugar: reads `el.title`, writes it back on input
  (host-property sugar, not hidden parent state).
- `$(slot())` projects light-DOM children; `$(slot('footer', ''))` is a named slot
  with fallback.
- `once(key, setup)` runs a rare DOM-local setup once per connection (return a
  function for cleanup); `onDisconnect(fn)` is the lower-level teardown hatch.

### Template syntax

| Form | Meaning |
|---|---|
| `$(expr)` | Evaluate JavaScript, HTML-escape the result. |
| `$identifier` | Shorthand for a single-identifier interpolation. |
| `$ statement` | Run a JavaScript statement line (chain lines for multi-line). |
| `${ ... }` | Run a JavaScript block. |
| `.property="$(expr)"` | Set a JS property on a rendered element (rich values, no stringify). |
| `on<event>="...body..."` | Add a listener; value is a function body. |

Control flow is JavaScript, not a second DSL:

```html
$ (items || []).forEach(item => {
  <todo-item jst-key="$(item.id)" .item="$(item)"
             ontoggle="el.emit('toggle', event.detail)"></todo-item>
$ })
```

## CRITICAL: handlers are function bodies, never `$()`

An `on<event>` value is a plain function body, the native inline-handler contract:
`event` is in scope and `this` is the element. Template values (`item`, `el`, your
declared attributes) stay live inside it. A `$(...)` form or a line starting with
`$ ` inside a handler body is a compile error.

```html
<!-- RIGHT: plain statements -->
<button onclick="el.count = (el.count || 0) + 1">+</button>
<form onsubmit="event.preventDefault(); save()">...</form>

<!-- WRONG: $() interpolation inside a handler (compile error) -->
<button onclick="$(el.count = el.count + 1)">+</button>
```

One quirk: JST handlers do not resolve undotted names against the element, so write
`this.value`, never bare `value`. Handler helpers are in scope in every body (and
`JST.fn.*` / module imports elsewhere): `changed(event)`, `debounce(event, ms, fn)`,
`throttle(event, ms)`, `keys(event, map)`, `commands(event, map)`.

```html
<input oninput="if (changed(event)) debounce(event, 300, () => search(this.value))">
<div onkeydown="keys(event, { Enter: () => go(), Escape: () => close() })">
<button oncommand="commands(event, { '--save': save })">
```

Dotted modifiers configure registration only: `.once`, `.capture`, `.passive`,
`.outside` (attaches to document, fires for events outside the element). `onreveal`
is a synthetic event fired when the element scrolls into view.

Component/synthetic event handlers written inline in ordinary body HTML (not in a
template) need `configure({ unsafeInlineHandlers: true })`, because the browser only
wires its own event names. Off by default; never enable on pages that interpolate
untrusted data into HTML. `addEventListener` always works without the flag.

## Attributes down, events up

State lives in the page, the parent, or the server: there is no store, no proxies,
no hidden graph. A component is a controlled renderer. Assigning a declared property
publishes state and re-renders. Because JST cannot tell whether an object was
mutated, assigning the same reference is an explicit publish:

```js
list.items.push(next);
list.items = list.items;          // re-render (same-reference publish)
list.items = [...list.items, next];  // immutable-style also works
```

Inside a handler, read the live property when the next value depends on the current
one: `el.count = (el.count || 0) + 1`.

## Safety model

- `$(expr)` HTML-escapes by default. Safe for untrusted text in element content and
  quoted attributes.
- `url(value)` guards URL-bearing attributes against dangerous schemes:
  `href="$(url(userLink))"`.
- `trustedHTML(value)` is the only opt-out of escaping. Pass only HTML your app
  produced or sanitized: `$(trustedHTML(renderedMarkdown))`.
- Fetched JST templates are executable code. Scope registration with
  `autoRegisterRoot` and allowlist names in `resolveTemplate`. `jst-nav` and
  `jst-behaviors` read attribute values as inert strings (URLs, selectors, names),
  never eval them, so injected server HTML cannot smuggle code.

## jst-nav: server-driven navigation

`jst-nav.js` upgrades elements that already act: the URL and verb come from the
element's own `href` / `action` / `method`, and any effect attribute opts it in. It
degrades to normal navigation with JS off. Unsafe same-origin requests carry the
CSRF token from `<meta name="csrf-token">`.

```html
<a href="/page/2" jst-target="#list">next</a>
<form action="/orders" method="post" jst-target="#list" jst-swap="beforeend">...</form>
```

- `jst-target` is a CSS selector for where the response lands (also `this`,
  `closest <sel>`, `find <sel>`).
- `jst-swap`: `innerHTML` (default), `outerHTML`, `beforebegin`/`afterbegin`/
  `beforeend`/`afterend`, `delete`, `none`, `morph`, `transition` (View Transitions).
- `jst-select` pulls a subtree (its outer HTML) out of a full-page response.
- Others: `jst-push-url` / `jst-replace-url`, `jst-confirm`, `jst-boost` (boost every
  descendant link/form), `jst-target-4xx/5xx/error` + `jst-swap-4xx/5xx/error` to
  route error responses, and `jst-swap-oob` in the response for out-of-band swaps.

Programmatic causes (keystrokes, reveal, polling, websockets) call the same
pipeline: `swap(target, url, options)` is the bare primitive; `navigate(url,
options)` (a named export, also on `JST.nav`) drives the full enhanced-element
pipeline (lifecycle events, confirm, select, history) as if a link were clicked
and returns the Response (null when cancelled).

```js
import { swap } from './jst-nav.js';
setInterval(() => swap('#status', '/job/42'), 2000);
```

Lifecycle events bubble and are cancelable: `jst:before-request`, `jst:before-swap`.
`jst:response-error` carries the body as `detail.text` for a toast.
`jst:swap-missed` fires (instead of a silent success) when the target is gone by
write time. Pluggable confirm: assign `JST.nav.confirm = (message, el) => boolean |
Promise<boolean>` to drive an inline UI instead of `window.confirm`.

### morph and jst-preserve

`jst-swap="morph"` needs `jst.js` loaded (it provides `JST.morph`); without it,
jst-nav warns once and falls back to `innerHTML`. morph treats the incoming HTML as
the source of truth: it reconciles each plain element's attributes to the new values
and walks children, keeping node identity where structure lines up (`jst-key` pairs
keyed children across reorders), so focus, scroll, and open/closed state survive.

morph composes with `jst-select`: when the selected response root is the target
(same tag, or same `id`), morph reconciles element-to-element in place instead of
nesting the root inside itself, making morph a drop-in upgrade for any `outerHTML`
region swap. A plain `jst-swap="morph"` without a select keeps its child-list meaning.

`jst-preserve` freezes a plain node against morph (attributes, form properties, and
whole subtree left untouched). Use it for the two cases morph would otherwise break:
an attribute that legitimately changes every render (an `<iframe src>` with a
per-render signed token, which reloads and loses loaded state) and live DOM state the
HTML does not capture (a `<video>` mid-playback, a `<canvas>`, a third-party widget).
`jst-key` does not cover this, because a keyed match still has its attributes
reconciled. Keep emitting the element server-side (a bare stub is fine, its
attributes are ignored) and pair with `jst-key` when siblings can shift. Registered
custom elements and `<jst-slot>` are already preservation boundaries.

```html
<iframe jst-preserve jst-key="embed" src="/embed?token=abc123"></iframe>
```

## jst-layout: the token contract and primitives

Everything in the JST CSS lives in the `jst` cascade layer, so any unlayered app
stylesheet outranks it with a plain selector, no specificity games. Theme by
overriding `--jst-*` tokens at `:root`; structure stays put, the look re-themes.

- Spacing is one modular scale: `--jst-space` (base) and `--jst-ratio` derive
  `--jst-space-3xs ... --jst-space-2xl`. Loosen a whole app by raising `--jst-space`.
- Color roles: `--jst-bg`, `--jst-surface`, `--jst-fg`, `--jst-muted`, `--jst-border`,
  status `--jst-ok`/`--jst-warn`/`--jst-error` (each with a `-fg`). Built on
  `light-dark()`; `[data-scheme="light"|"dark"]` on `<html>` (or a subtree) is the
  whole dark-mode toggle.
- `--jst-accent` drives a derived ramp (`--jst-accent-400/600/700`) via relative
  color syntax (`oklch(from ...)`). Override the accent alone and the ramp follows.
  Native controls pick it up via `accent-color`.

Layout primitives are styled by element selector, zero JavaScript (the Every Layout
set): `jst-stack`, `jst-cluster`, `jst-grid`, `jst-sidebar`, `jst-center`,
`jst-box`, `jst-switcher`, `jst-cover`, `jst-frame`, `jst-reel`, `jst-imposter`,
`jst-field`, `jst-form-row`. Tune a single instance with inline custom properties
rather than new classes.

## jst-components: patterns on native primitives

Each component is plain HTML on a native primitive (`<dialog>` + Invoker Commands for
modal/drawer, `[popover]` for menus, `<details>`/`<summary>` for accordion,
`<progress>`, styled native checkbox for switches) plus a few genuine JST components
(tabs, toaster, combobox, sortable table, command palette). Theme skins
(`[data-theme="bootstrap|shadcn|shoelace|pico|..."]`) override only tokens, so the
same markup re-skins to any framework's look. Buttons re-role via `data-variant`
(`quiet`, `ghost`, `danger`); badges and alerts likewise.

## Verifying a change

No build step: serve the repo root (`python3 -m http.server 8000`) and open the file
(`index.html`, `examples/kanban.html`, `framework_parity/index.html`). Set
`configure({ dev: true })` for visible error boxes instead of stale/empty DOM.
Components are real custom elements in light DOM, so a test renders one into a DOM,
sets attributes and properties, dispatches events, and asserts on `innerHTML` (no
special renderer). `npm test` runs the whole suite (node `--test` runtime and
regression, lint, browser, example smoke, framework-parity verify). After changing
template syntax run `node tools/lint.mjs`, since removed syntax only errors when a
component renders in the browser.

## Upgrading a vendored copy

`CHANGELOG.md` is the migration guide: every release entry states what changed
and how to migrate it. Pre-1.0 semver: a minor bump (`0.6` to `0.7`) means
breaking changes, a patch bump is compatible.

1. Find the app's current version: `grep "export const version" jst.js` in the
   vendored files (or `JST.version` in the console, which reports the runtime
   actually live, useful when a stale cache is suspected).
2. Read `CHANGELOG.md` top-down from the target version back to the vendored
   one. Collect the migration steps from each entry crossed.
3. Copy ALL the distributables from the target tag over the vendored ones in one
   move: runtime, module deps, jst-nav, jst-behaviors, both stylesheets,
   jst-components.html, minified twins. Mixed versions drift silently.
4. From a checkout of the jst repo at the target tag, run `node tools/lint.mjs`
   over the app's HTML to find removed syntax (stale forms fail loud there
   instead of at first render), and `node tools/codemod.mjs` to apply the
   mechanical rewrites (it handled the handler-body migration across whole apps).
5. Browser-verify with `configure({ dev: true })`: stale template syntax and
   render errors surface as visible error boxes, not silently empty DOM.

## Common mistakes (from the fix history)

- Writing `$(...)` or `$ ...` inside a handler body (handlers are function bodies),
  or bare `value` instead of `this.value`.
- Mutating an array without republishing: assign `el.items = el.items` (or a fresh
  array) to render.
- `jst-swap="morph"` without loading `jst.js`: it silently falls back to `innerHTML`,
  so focus/scroll/open state you expected to survive does not.
- Morph nesting a region inside itself: with `jst-select`, ensure the selected root
  is the target (matching tag or id) so morph reconciles in place.
- Letting morph reload a signed `<iframe src>` or wipe a `<video>`/`<canvas>`: mark
  it `jst-preserve` (plus `jst-key` when siblings shift). `jst-key` alone still
  reconciles attributes.
- Enabling `unsafeInlineHandlers` on a page with untrusted data, or reaching for it
  when `addEventListener` / a template handler works; passing user input to
  `trustedHTML()` (it is the escape hatch, not the default).
