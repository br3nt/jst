# JST framework-parity study

Can JST reproduce the canonical examples of **HTMX, Alpine.js, Vue, and React**?
For every example we built a JST equivalent, validated it loads clean, and
behaviourally spot-checked a representative sample. Where an example needs a
"backend", a front-end `fetch` intercept (`lib/mock-fetch.js`) returns HTML
fragments — which may themselves contain `<script type="jst">` definitions that
auto-register and render on arrival (JST's `MutationObserver`).

**No JST core code was modified.** If something couldn't be done idiomatically,
that is recorded as a gap — never patched away.

## Headline

| | ✓ exact | (i) partial | ✗ none | total |
|---|---:|---:|---:|---:|
| HTMX | 9 | 7 | 0 | 16 |
| Alpine.js | 10 | 10 | 0 | 20 |
| Vue | 8 | 12 | 0 | 20 |
| React | 8 | 6 | 0 | 14 |
| **Total** | **35** | **35** | **0** | **70** |

**Every example was reproduced** — half (35) as exact, idiomatic matches, half
(35) needing a documented workaround. **Zero were impossible.** But "no ✗" is not
"no gaps": several `(i)` rows contain genuinely unclosable sub-gaps (true
enter/leave/move animations, component self-teardown on unmount, keyed list
reconciliation). Those are called out in **Gaps** below; that section is the
point of this study.

Legend: **✓** idiomatic JST, no hacks · **(i)** reproduced but needed a
workaround (extra imperative JS, manual wiring, CSS substitute, or a behavioural
deviation) · **✗** could not reproduce.

## Browse them as a website

There's a clickable hub — sidebar of all 70 examples grouped by framework with
status badges, a filter, an embedded viewer, prev/next, and shareable `#hash`
URLs (itself built in JST). From `custom_js_components/`:

```sh
python3 -m http.server 8765            # or any static server at the repo root
```

then open **http://localhost:8765/framework_parity/index.html**
(deep-link an example with e.g. `…/index.html#htmx/click-to-edit.html`).
Open a single example directly at `…/framework_parity/htmx/click-to-edit.html`.

Validate all pages load without console/JST errors:

```sh
node framework_parity/verify.mjs framework_parity/**/*.html
```

(The links in the tables below are relative file paths; open them via the server
above, not `file://`, since they load `/jst.js` by absolute path.)

---

## HTMX — 9 ✓ / 7 (i)

The fetch-returns-fragment model is JST's natural fit; the `(i)`s are almost all
about **triggers HTMX gives declaratively** (debounce, poll, reveal) and exit
animations.

| Example | Source | Status | Built | Note |
|---|---|:--:|---|---|
| click-to-edit | [link](https://htmx.org/examples/click-to-edit/) | ✓ | [htmx/click-to-edit.html](htmx/click-to-edit.html) | View↔edit on an `editing` flag; PUT persists; props re-render. |
| bulk-update | [link](https://htmx.org/examples/bulk-update/) | ✓ | [htmx/bulk-update.html](htmx/bulk-update.html) | Checkbox changes stage a draft; one POST applies all + toast. |
| click-to-load | [link](https://htmx.org/examples/click-to-load/) | ✓ | [htmx/click-to-load.html](htmx/click-to-load.html) | Fetch next page, concat to page-owned array, re-render. |
| delete-row | [link](https://htmx.org/examples/delete-row/) | (i) | [htmx/delete-row.html](htmx/delete-row.html) | Round-trip clean, but fade-out needs a `deleting` class + `setTimeout`; coarse re-render yanks the node instantly otherwise. |
| edit-row | [link](https://htmx.org/examples/edit-row/) | ✓ | [htmx/edit-row.html](htmx/edit-row.html) | Page owns rows + one `editingId`; other Edit buttons disabled while editing. |
| lazy-load | [link](https://htmx.org/examples/lazy-load/) | ✓ | [htmx/lazy-load.html](htmx/lazy-load.html) | Fetched fragment ships a `<script type="jst">` def + markup; auto-upgraded on insert. |
| inline-validation | [link](https://htmx.org/examples/inline-validation/) | ✓ | [htmx/inline-validation.html](htmx/inline-validation.html) | Plain input (keeps focus) POSTs per keystroke; `<field-status>` renders verdict. |
| infinite-scroll | [link](https://htmx.org/examples/infinite-scroll/) | (i) | [htmx/infinite-scroll.html](htmx/infinite-scroll.html) | Data/append idiomatic, but the trigger is a hand-wired IntersectionObserver re-attached after each render (no `revealed` trigger). |
| active-search | [link](https://htmx.org/examples/active-search/) | (i) | [htmx/active-search.html](htmx/active-search.html) | Results component clean, but debounce is a hand-written `setTimeout` (no `delay:` modifier). |
| progress-bar | [link](https://htmx.org/examples/progress-bar/) | (i) | [htmx/progress-bar.html](htmx/progress-bar.html) | Bar is prop-driven, but polling is a hand-written `setInterval` (no `every Ns`). |
| value-select (cascading) | [link](https://htmx.org/examples/value-select/) | ✓ | [htmx/value-select.html](htmx/value-select.html) | `change` fetches models, sets a prop on `<model-select>`. |
| tabs-hateoas | [link](https://htmx.org/examples/tabs-hateoas/) | ✓ | [htmx/tabs-hateoas.html](htmx/tabs-hateoas.html) | Each tab fetch returns a fresh component def + markup; auto-upgraded. Pure HATEOAS — JST's core strength. |
| dialogs (custom modal) | [link](https://htmx.org/examples/modal-custom/) | (i) | [htmx/modal-custom.html](htmx/modal-custom.html) | Server-fed modal + fade-in clean; fade-out needs a `closing` state + `setTimeout` (no transition directive). |
| sortable | [link](https://htmx.org/examples/sortable/) | ✓ | [htmx/sortable.html](htmx/sortable.html) | Native HTML5 DnD via `@dragstart/@dragover/@drop`; reorders a page array + POSTs order. (Index-based morph — see keyed-list gap.) |
| keyboard-shortcuts | [link](https://htmx.org/examples/keyboard-shortcuts/) | (i) | [htmx/keyboard-shortcuts.html](htmx/keyboard-shortcuts.html) | Result panel clean, but global shortcut is a hand-written `document.addEventListener` (`@event` only binds template elements). |
| polling / update-other-content | [link](https://htmx.org/examples/update-other-content/) | (i) | [htmx/polling.html](htmx/polling.html) | One response updating two regions is idiomatic; polling itself is a hand-written `setInterval`. |

## Alpine.js — 10 ✓ / 10 (i)

Directives split cleanly: rendering/binding/events map exactly; **two-way
binding, reactivity primitives, transitions, and DOM-relocation** need
workarounds. `x-cloak` is actually *better* in JST.

| Feature | Source | Status | Built | Note |
|---|---|:--:|---|---|
| x-data + counter | [link](https://alpinejs.dev/directives/data) | ✓ | [alpine/data.html](alpine/data.html) | Params are reactive scope; `el.count = count + 1` updates own state. |
| x-text | [link](https://alpinejs.dev/directives/text) | ✓ | [alpine/text.html](alpine/text.html) | `$(expr)` escaped text interpolation. |
| x-html | [link](https://alpinejs.dev/directives/html) | ✓ | [alpine/html.html](alpine/html.html) | `$(raw(expr))` opts out of escaping. |
| x-bind (class & attrs) | [link](https://alpinejs.dev/directives/bind) | ✓ | [alpine/bind.html](alpine/bind.html) | Interpolation in attribute value and name position. |
| x-on (events + key modifiers) | [link](https://alpinejs.dev/directives/on) | (i) | [alpine/on.html](alpine/on.html) | `@event` covers listeners exactly, but no `.enter`/`.prevent`/`.stop` sugar — done by hand. |
| x-model (text/checkbox/select) | [link](https://alpinejs.dev/directives/model) | (i) | [alpine/model.html](alpine/model.html) | No two-way binding; wired both directions per field. *(behaviourally verified)* |
| x-show | [link](https://alpinejs.dev/directives/show) | ✓ | [alpine/show.html](alpine/show.html) | `style="$(open?'':'display:none')"` keeps node mounted. |
| x-if | [link](https://alpinejs.dev/directives/if) | ✓ | [alpine/if.html](alpine/if.html) | `$ if (cond) { … }` includes/excludes from render. |
| x-for | [link](https://alpinejs.dev/directives/for) | ✓ | [alpine/for.html](alpine/for.html) | `$ items.forEach(...)`. (No keyed reconciliation — see gap.) |
| x-transition | [link](https://alpinejs.dev/directives/transition) | (i) | [alpine/transition.html](alpine/transition.html) | CSS transition on a toggled class; can't animate true insert/remove. |
| x-ref + $refs | [link](https://alpinejs.dev/directives/ref) | (i) | [alpine/ref.html](alpine/ref.html) | No `$refs` registry; `el.querySelector(...)` instead. |
| x-init | [link](https://alpinejs.dev/directives/init) | (i) | [alpine/init.html](alpine/init.html) | No template init hook; one-time guard + `queueMicrotask`. |
| x-effect | [link](https://alpinejs.dev/directives/effect) | (i) | [alpine/effect.html](alpine/effect.html) | Effect = template body, but coarse (any param change), not dep-tracked. |
| $dispatch | [link](https://alpinejs.dev/magics/dispatch) | ✓ | [alpine/dispatch.html](alpine/dispatch.html) | `el.emit(name, detail)` bubbling CustomEvent. |
| $store (global) | [link](https://alpinejs.dev/globals/alpine-store) | (i) | [alpine/store.html](alpine/store.html) | Shared object passed via props; manually re-published to subscribers. |
| $watch | [link](https://alpinejs.dev/magics/watch) | (i) | [alpine/watch.html](alpine/watch.html) | No watch; funnel mutations through one setter that captures old→new. |
| x-cloak | [link](https://alpinejs.dev/directives/cloak) | ✓ | [alpine/cloak.html](alpine/cloak.html) | **Better:** custom-element `:not(:defined){display:none}` — zero JS. |
| x-teleport | [link](https://alpinejs.dev/directives/teleport) | (i) | [alpine/teleport.html](alpine/teleport.html) | No teleport; hoisted modal to a body-level component driven by events. |
| dropdown (click-outside) | [link](https://alpinejs.dev/component/dropdown) | (i) | [alpine/dropdown.html](alpine/dropdown.html) | Open/close idiomatic, but no `@click.outside` — guarded `document` listener. |
| tabs | [link](https://alpinejs.dev/start-here) | ✓ | [alpine/tabs.html](alpine/tabs.html) | Active tab is local state; no gap. |

## Vue — 8 ✓ / 12 (i)

Templating, components, events, and slots map 1:1. The `(i)`s cluster around
**v-model, computed/watch, lifecycle, provide/inject, and transitions** — Vue's
reactivity and animation systems are where JST is thinnest.

| Example / feature | Source | Status | Built | Note |
|---|---|:--:|---|---|
| Hello World | [link](https://vuejs.org/examples/#hello-world) | (i) | [vue/hello-world.html](vue/hello-world.html) | Reactive text exact; the v-model input is manual `.value` + `@input`. |
| Handling Input | [link](https://vuejs.org/examples/#handling-input) | ✓ | [vue/handling-input.html](vue/handling-input.html) | "methods" are plain functions from `@click`. |
| Attribute Bindings | [link](https://vuejs.org/examples/#attribute-bindings) | ✓ | [vue/attribute-bindings.html](vue/attribute-bindings.html) | Interpolation + `.disabled` prop binding. |
| Conditionals & Loops | [link](https://vuejs.org/examples/#conditionals-and-loops) | ✓ | [vue/conditionals-and-loops.html](vue/conditionals-and-loops.html) | `$ if/else`, `$ forEach`. |
| Form Bindings (v-model) | [link](https://vuejs.org/examples/#form-bindings) | (i) | [vue/form-bindings.html](vue/form-bindings.html) | All field types manual two-way. *(behaviourally verified in TodoMVC)* |
| Simple Component (props) | [link](https://vuejs.org/examples/#simple-component) | ✓ | [vue/simple-component.html](vue/simple-component.html) | Primitives via attrs, rich via `.todo="$(item)"`. |
| Component events ($emit) | [link](https://vuejs.org/guide/components/events) | ✓ | [vue/component-events.html](vue/component-events.html) | `el.emit` + `addEventListener`. |
| Computed | [link](https://vuejs.org/guide/essentials/computed) | (i) | [vue/computed.html](vue/computed.html) | Derive inline with `$ const`; no memoization. |
| Watchers | [link](https://vuejs.org/guide/essentials/watchers) | (i) | [vue/watchers.html](vue/watchers.html) | Side effect runs in the mutating handler. |
| Lifecycle | [link](https://vuejs.org/guide/essentials/lifecycle) | (i) | [vue/lifecycle.html](vue/lifecycle.html) | `mounted` approximable; **no unmounted** hook. |
| Slots (default + named) | [link](https://vuejs.org/guide/components/slots) | ✓ | [vue/slots.html](vue/slots.html) | `$(slot())`, `$(slot('name','fallback'))` native. |
| provide / inject | [link](https://vuejs.org/guide/components/provide-inject) | (i) | [vue/provide-inject.html](vue/provide-inject.html) | `el.closest()` to read ancestor; not auto-reactive. |
| Template refs | [link](https://vuejs.org/guide/essentials/template-refs) | (i) | [vue/template-refs.html](vue/template-refs.html) | `el.querySelector(...)` after render. |
| Class & Style bindings | [link](https://vuejs.org/guide/essentials/class-and-style) | ✓ | [vue/class-and-style.html](vue/class-and-style.html) | No object/array sugar, but expression-built strings cover it. |
| Fetching Data | [link](https://vuejs.org/examples/#fetching-data) | (i) | [vue/fetching-data.html](vue/fetching-data.html) | Fetch/render exact; initial fetch page-driven (no onMounted). |
| Markdown Editor | [link](https://vuejs.org/examples/#markdown) | (i) | [vue/markdown.html](vue/markdown.html) | `$(raw())` renders md; preview updated imperatively (controlled textarea resets caret). |
| Grid (sort/search) | [link](https://vuejs.org/examples/#grid) | ✓ | [vue/grid.html](vue/grid.html) | Local state; filtered/sorted rows derived inline. |
| TodoMVC | [link](https://vuejs.org/examples/#todomvc) | (i) | [vue/todomvc.html](vue/todomvc.html) | Full feature set; edit-focus needs a queued re-focus; manual two-way throughout. *(behaviourally verified)* |
| List transitions | [link](https://vuejs.org/examples/#list-transition) | (i) | [vue/list-transition.html](vue/list-transition.html) | CSS handles ENTER; **LEAVE and FLIP move not reproducible**. |
| Modal with transition | [link](https://vuejs.org/examples/#modal) | (i) | [vue/modal.html](vue/modal.html) | No `<transition>`; kept in DOM, class toggled, CSS does enter+leave. |

## React — 8 ✓ / 6 (i)

React's "lift state up + props down" is *exactly* JST's model, so the structural
examples are clean ✓. The `(i)`s are **controlled inputs, effects/cleanup,
context, and keyed lists** — i.e. hooks and reconciliation.

| Concept / example | Source | Status | Built | Note |
|---|---|:--:|---|---|
| useState (counter) | [link](https://react.dev/learn/state-a-components-memory) | ✓ | [react/state-counter.html](react/state-counter.html) | A param is local state; instances independent. *(verified)* |
| Passing props | [link](https://react.dev/learn/passing-props-to-a-component) | ✓ | [react/passing-props.html](react/passing-props.html) | Rich via `.person`, primitives via attrs. |
| Rendering lists (keys) | [link](https://react.dev/learn/rendering-lists) | (i) | [react/rendering-lists.html](react/rendering-lists.html) | Rendering idiomatic, but **no `key`** — input text sticks to position, not data, on reorder. *(gap proven in headless run)* |
| Conditional rendering | [link](https://react.dev/learn/conditional-rendering) | ✓ | [react/conditional-rendering.html](react/conditional-rendering.html) | `$ if/else`; empty branch = "render null". |
| Responding to events | [link](https://react.dev/learn/responding-to-events) | ✓ | [react/responding-to-events.html](react/responding-to-events.html) | `@event` + `el.emit`; stopPropagation works. |
| Controlled inputs | [link](https://react.dev/learn/reacting-to-input-with-state) | (i) | [react/controlled-inputs.html](react/controlled-inputs.html) | Manual `.value` + `@input`; mid-string edits can bounce the caret. |
| Lifting state up | [link](https://react.dev/learn/sharing-state-between-components) | ✓ | [react/lifting-state-up.html](react/lifting-state-up.html) | JST's native model. |
| Effects + fetching | [link](https://react.dev/learn/synchronizing-with-effects) | (i) | [react/effects-fetching.html](react/effects-fetching.html) | Guarded render block + stale-response guard; **no unmount cleanup**. |
| Context (useContext) | [link](https://react.dev/learn/passing-data-deeply-with-context) | (i) | [react/context.html](react/context.html) | Prop-drill + page store; intermediates must forward. |
| Refs (useRef) | [link](https://react.dev/learn/manipulating-the-dom-with-refs) | ✓ | [react/refs.html](react/refs.html) | DOM ref via `querySelector`; mutable ref via `el._x`. |
| Children / composition | [link](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children) | ✓ | [react/children-composition.html](react/children-composition.html) | `$(slot())` + named slots 1:1. |
| useReducer | [link](https://react.dev/learn/extracting-state-logic-into-a-reducer) | (i) | [react/reducer.html](react/reducer.html) | Plain `reducer(state, action)` in the page; dispatch reassigns. |
| Thinking in React (filter table) | [link](https://react.dev/learn/thinking-in-react) | (i) | [react/thinking-in-react.html](react/thinking-in-react.html) | Maps perfectly; inherits the controlled-input caveat. |
| Tic-tac-toe (time travel) | [link](https://react.dev/learn/tutorial-tic-tac-toe) | ✓ | [react/tic-tac-toe.html](react/tic-tac-toe.html) | Immutable history + currentMove in page; board is a dumb renderer. *(verified incl. time travel)* |

---

## Gaps — what JST can't (yet) do idiomatically

Ordered by how often they forced an `(i)`, with a verdict on whether the
workaround is an acceptable tradeoff. **You decide.**

1. **No two-way binding** (`v-model`/`x-model`). Every form control is manual:
   `.value`/`.checked` down + `@input`/`@change` up. *Verdict: acceptable but the
   single most-repeated boilerplate — a `bind` helper would remove most of it
   without touching the core model.*
2. **No transition/animation system** (`x-transition`, Vue `<transition>`,
   list transitions). Enter animations work via CSS-on-mount; **true leave and
   FLIP-move animations are not reproducible** because coarse re-render removes
   nodes instantly. *Verdict: the hardest gap; partly unclosable without a
   leave-hook in the morph. Exit-animation workaround (`closing` state +
   setTimeout) is clunky but works for single elements, not lists.*
3. **No keyed list reconciliation.** Morphing is index-based; there is no `key`,
   so per-item DOM/input state sticks to **position, not data**, on reorder
   (proven). *Verdict: fine for static/append-only lists; a real correctness
   risk for reorderable lists with embedded state (focus, uncontrolled inputs,
   nested widgets).*
4. **No lifecycle hooks for authors**, especially **no unmount/disconnect**.
   `mounted` is approximable (one-time guard + microtask); teardown is not — a
   component cannot clean up its own timers/listeners/subscriptions. *Verdict:
   acceptable for fetch-on-change; a real gap for long-lived subscriptions.*
5. **No reactivity primitives** (computed/watch/effect). Derive inline with
   `$ const`; "watch" by acting in the mutating handler. *Verdict: works and
   re-runs exactly when the (coarse) re-render fires; no memoization or
   dependency tracking — fine at these sizes, would not scale to heavy derived
   state.*
6. **No DI / context / global store.** Prop-drill or a page-level shared object;
   intermediates must forward; reads via `el.closest()` aren't auto-reactive.
   *Verdict: acceptable and explicit for shallow trees; a boilerplate tax that
   grows with depth.*
7. **No declarative server bindings or triggers** (the HTMX premise). Every
   server call is a hand-written `fetch` handler; no `delay:` (debounce),
   `every Ns` (poll), or `revealed` (scroll) triggers — those become
   `setTimeout`/`setInterval`/`IntersectionObserver`. *Verdict: this is JST's
   model by design (page owns state, components render); pleasant for the ✓
   cases, but the missing trigger sugar is the clearest "could add a helper"
   opportunity.*
8. **No event/key modifiers** (`.prevent`/`.stop`/`.enter`/`.outside`) and **no
   template-level global/document binding**. All done by hand in handlers.
   *Verdict: minor; fully functional, just less declarative.*
9. **Controlled-input caret bounce.** Whole-component re-render rewrites text
   nodes, so mid-string edits on a controlled input can jump the caret to the
   end; heavy editing surfaces are better updated imperatively. *Verdict:
   acceptable for typical append typing; rough for in-place editing.*
10. **No teleport/portal.** A component renders into its own light DOM; modals
    must be hoisted to a body-level component driven by events. *Verdict:
    achievable, loses co-location ergonomics.*

### Where JST is a strong or *better* fit
- **"Server returns components" (HTMX's premise)** — the `MutationObserver`
  auto-registers fetched `<script type="jst">` fragments; `lazy-load` and
  `tabs-hateoas` are clean and idiomatic. This is the standout strength.
- **Lift-state-up / props-down-events-up** — React's `lifting-state`, `reducer`,
  and the whole tic-tac-toe tutorial are exact, often *cleaner*, matches.
- **Slots / composition**, **conditionals & loops**, **attribute/class/style
  interpolation**, **events**, **DOM & mutable refs** — all exact.
- **`x-cloak`** is *better*: native `:not(:defined)` cloaking, zero JS.

## Authoring footguns surfaced (findings, not fixes)

These bit the build and are worth a tooling diagnostic (cf. `tooling/vscode-jst`),
**not** a core change:
- `$…` interpolation is processed **inside HTML comments within a template**, so
  `<!-- $foo -->` compiles to a reference to undefined `foo`. Avoid `$` in
  template comments.
- `${ … }` statement blocks are fragile without inner braces; prefer `$ ` line
  statements for control flow.
- `$` inside **regex literals** in `$ ` lines mis-tokenizes; keep regex-bearing
  logic in a plain `<script>`.
- **Multi-word params must be declared kebab-case** (`editing-id`) and read
  camelCase (`editingId`); declaring `editingId` silently lowercases to
  `editingid` and reads as `undefined` in the template (the JS property
  `el.editingId` still works, which makes the mismatch more confusing).
- Event handlers close over **render-time values**; multiple synchronous
  mutations in one microtask coalesce (same class of footgun as React's
  `setCount(count + 1)`).

## Method & validation

- Built by four parallel subagents (one per framework), each given a JST primer
  (`JST_PRIMER.md`) and forbidden from editing JST core.
- **All 70 pages** independently re-validated to load with no console/JST errors
  (`verify.mjs`).
- **6 examples** spanning all four frameworks and both ✓/(i) statuses were driven
  in headless Chrome with real interactions and asserted (click-to-edit save,
  active-search debounce, x-model two-way sync, TodoMVC add/count, tic-tac-toe
  win + time-travel, and the rendering-lists keyed-gap proof). All passed.
- Nothing was impossible (0 ✗); nothing got stuck.

_Infra: `lib/mock-fetch.js` (front-end backend), `JST_PRIMER.md` (build guide),
`verify.mjs` (load validator), `_infra_smoke.html` (mock + late-fragment demo)._
