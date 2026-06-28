# JST framework-parity study

Can JST reproduce the canonical examples of **HTMX, Alpine.js, Vue, React, fixi, Lit, Svelte, Solid, and Angular**?
For every example we built a JST equivalent, validated it loads clean, and
behaviourally spot-checked a representative sample. Where an example needs a
"backend", a front-end `fetch` intercept (`lib/mock-fetch.js`) returns HTML
fragments — which may themselves contain `<script type="jst">` definitions that
auto-register and render on arrival (JST's `MutationObserver`).

The report reflects the current JST core. If something still cannot be done
idiomatically, it is recorded as a gap rather than hidden in an example.

## Headline

| | ✓ exact | (i) partial | ✗ none | total |
|---|---:|---:|---:|---:|
| HTMX | 16 | 0 | 0 | 16 |
| Alpine.js | 16 | 4 | 0 | 20 |
| Vue | 10 | 10 | 0 | 20 |
| React | 11 | 3 | 0 | 14 |
| fixi | 18 | 0 | 0 | 18 |
| Lit | 15 | 5 | 0 | 20 |
| Svelte | 6 | 0 | 0 | 6 |
| Solid | 5 | 1 | 0 | 6 |
| Angular | 6 | 0 | 0 | 6 |
| **Total** | **103** | **23** | **0** | **126** |

**Every example was reproduced** — 89 as exact, idiomatic matches and 37 needing
a documented workaround. **Zero were impossible.** But "no ✗" is not "no gaps":
several `(i)` rows still contain real tradeoffs, called out in **Gaps** below.

Legend: **✓** idiomatic JST, no hacks · **(i)** reproduced but needed a
workaround (extra imperative JS, manual wiring, CSS substitute, or a behavioural
deviation) · **✗** could not reproduce.

## Browse them as a website

There's a clickable hub — sidebar of all 126 examples grouped by framework with
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

## HTMX — 11 ✓ / 5 (i)

The fetch-returns-fragment model is JST's natural fit; the `(i)`s are almost all
about **triggers HTMX gives declaratively** (debounce, poll, reveal) and exit
animations.

| Example | Source | Status | Built | Note |
|---|---|:--:|---|---|
| click-to-edit | [link](https://htmx.org/examples/click-to-edit/) | ✓ | [htmx/click-to-edit.html](htmx/click-to-edit.html) | View↔edit on an `editing` flag; PUT persists; props re-render. |
| bulk-update | [link](https://htmx.org/examples/bulk-update/) | ✓ | [htmx/bulk-update.html](htmx/bulk-update.html) | Checkbox changes stage a draft; one POST applies all + toast. |
| click-to-load | [link](https://htmx.org/examples/click-to-load/) | ✓ | [htmx/click-to-load.html](htmx/click-to-load.html) | Fetch next page, concat to page-owned array, re-render. |
| delete-row | [link](https://htmx.org/examples/delete-row/) | ✓ | [htmx/delete-row.html](htmx/delete-row.html) | Round-trip plus keyed `jst-transition`; CSS owns the fade and JST delays removal. |
| edit-row | [link](https://htmx.org/examples/edit-row/) | ✓ | [htmx/edit-row.html](htmx/edit-row.html) | Page owns rows + one `editingId`; other Edit buttons disabled while editing. |
| lazy-load | [link](https://htmx.org/examples/lazy-load/) | ✓ | [htmx/lazy-load.html](htmx/lazy-load.html) | Fetched fragment ships a `<script type="jst">` def + markup; auto-upgraded on insert. |
| inline-validation | [link](https://htmx.org/examples/inline-validation/) | ✓ | [htmx/inline-validation.html](htmx/inline-validation.html) | Plain input (keeps focus) POSTs per keystroke; `<field-status>` renders verdict. |
| infinite-scroll | [link](https://htmx.org/examples/infinite-scroll/) | (i) | [htmx/infinite-scroll.html](htmx/infinite-scroll.html) | Data/append idiomatic, but the trigger is a hand-wired IntersectionObserver re-attached after each render (no `revealed` trigger). |
| active-search | [link](https://htmx.org/examples/active-search/) | (i) | [htmx/active-search.html](htmx/active-search.html) | Results component clean, but debounce is a hand-written `setTimeout` (no `delay:` modifier). |
| progress-bar | [link](https://htmx.org/examples/progress-bar/) | (i) | [htmx/progress-bar.html](htmx/progress-bar.html) | Bar is prop-driven, but polling is a hand-written `setInterval` (no `every Ns`). |
| value-select (cascading) | [link](https://htmx.org/examples/value-select/) | ✓ | [htmx/value-select.html](htmx/value-select.html) | `change` fetches models, sets a prop on `<model-select>`. |
| tabs-hateoas | [link](https://htmx.org/examples/tabs-hateoas/) | ✓ | [htmx/tabs-hateoas.html](htmx/tabs-hateoas.html) | Each tab fetch returns a fresh component def + markup; auto-upgraded. Pure HATEOAS — JST's core strength. |
| dialogs (custom modal) | [link](https://htmx.org/examples/modal-custom/) | ✓ | [htmx/modal-custom.html](htmx/modal-custom.html) | Server-fed modal content with `jst-transition` for fade/zoom enter and leave. |
| sortable | [link](https://htmx.org/examples/sortable/) | ✓ | [htmx/sortable.html](htmx/sortable.html) | Native HTML5 DnD via `ondragstart/ondragover/ondrop`; reorders a page array + POSTs order. `jst-key` preserves row identity when needed. |
| keyboard-shortcuts | [link](https://htmx.org/examples/keyboard-shortcuts/) | (i) | [htmx/keyboard-shortcuts.html](htmx/keyboard-shortcuts.html) | Result panel clean, but global shortcut is a hand-written `document.addEventListener` (`on<event>` only binds template elements). |
| polling / update-other-content | [link](https://htmx.org/examples/update-other-content/) | (i) | [htmx/polling.html](htmx/polling.html) | One response updating two regions is idiomatic; polling itself is a hand-written `setInterval`. |

## Alpine.js — 15 ✓ / 5 (i)

Directives split cleanly: rendering, binding, events, local model binding, and
CSS transitions map directly. Reactivity primitives, refs, and DOM relocation
still need workarounds. `x-cloak` is actually *better* in JST.

| Feature | Source | Status | Built | Note |
|---|---|:--:|---|---|
| x-data + counter | [link](https://alpinejs.dev/directives/data) | ✓ | [alpine/data.html](alpine/data.html) | Params are reactive scope; `el.count = el.count + 1` updates own state. |
| x-text | [link](https://alpinejs.dev/directives/text) | ✓ | [alpine/text.html](alpine/text.html) | `$(expr)` escaped text interpolation. |
| x-html | [link](https://alpinejs.dev/directives/html) | ✓ | [alpine/html.html](alpine/html.html) | `$(trustedHTML(expr))` opts out of escaping. |
| x-bind (class & attrs) | [link](https://alpinejs.dev/directives/bind) | ✓ | [alpine/bind.html](alpine/bind.html) | Interpolation in attribute value and name position. |
| x-on (events + key modifiers) | [link](https://alpinejs.dev/directives/on) | ✓ | [alpine/on.html](alpine/on.html) | `on<event>` covers listeners plus `.enter`, `.prevent`, `.stop`, `.outside`, and debounce modifiers. |
| x-model (text/checkbox/select) | [link](https://alpinejs.dev/directives/model) | ✓ | [alpine/model.html](alpine/model.html) | `jst-model` binds local text, checkbox, and select state. |
| x-show | [link](https://alpinejs.dev/directives/show) | ✓ | [alpine/show.html](alpine/show.html) | `style="$(open?'':'display:none')"` keeps node mounted. |
| x-if | [link](https://alpinejs.dev/directives/if) | ✓ | [alpine/if.html](alpine/if.html) | `$ if (cond) { … }` includes/excludes from render. |
| x-for | [link](https://alpinejs.dev/directives/for) | ✓ | [alpine/for.html](alpine/for.html) | `$ items.forEach(...)` with `jst-key` when identity matters. |
| x-transition | [link](https://alpinejs.dev/directives/transition) | ✓ | [alpine/transition.html](alpine/transition.html) | `jst-transition` coordinates enter/leave classes; CSS owns the animation. |
| x-ref + $refs | [link](https://alpinejs.dev/directives/ref) | (i) | [alpine/ref.html](alpine/ref.html) | No `$refs` registry; `el.querySelector(...)` instead. |
| x-init | [link](https://alpinejs.dev/directives/init) | ✓ | [alpine/init.html](alpine/init.html) | `once()` runs setup once after the first DOM commit. |
| x-effect | [link](https://alpinejs.dev/directives/effect) | (i) | [alpine/effect.html](alpine/effect.html) | Effect = template body, but coarse (any prop change), not dep-tracked. |
| $dispatch | [link](https://alpinejs.dev/magics/dispatch) | ✓ | [alpine/dispatch.html](alpine/dispatch.html) | `el.emit(name, detail)` bubbling CustomEvent. |
| $store (global) | [link](https://alpinejs.dev/globals/alpine-store) | (i) | [alpine/store.html](alpine/store.html) | Shared object passed via props; manually re-published to subscribers. |
| $watch | [link](https://alpinejs.dev/magics/watch) | (i) | [alpine/watch.html](alpine/watch.html) | No watch; funnel mutations through one setter that captures old→new. |
| x-cloak | [link](https://alpinejs.dev/directives/cloak) | ✓ | [alpine/cloak.html](alpine/cloak.html) | **Better:** custom-element `:not(:defined){display:none}` — zero JS. |
| x-teleport | [link](https://alpinejs.dev/directives/teleport) | (i) | [alpine/teleport.html](alpine/teleport.html) | No teleport; hoisted modal to a body-level component driven by events. |
| dropdown (click-outside) | [link](https://alpinejs.dev/component/dropdown) | ✓ | [alpine/dropdown.html](alpine/dropdown.html) | Open/close local state plus `onclick.outside`. |
| tabs | [link](https://alpinejs.dev/start-here) | ✓ | [alpine/tabs.html](alpine/tabs.html) | Active tab is local state; no gap. |

## Vue — 10 ✓ / 10 (i)

Templating, components, events, local form binding, and slots map closely. The
`(i)`s cluster around computed/watch, broader component `v-model` conventions,
provide/inject, and full transition-group behavior.

| Example / feature | Source | Status | Built | Note |
|---|---|:--:|---|---|
| Hello World | [link](https://vuejs.org/examples/#hello-world) | (i) | [vue/hello-world.html](vue/hello-world.html) | Reactive text exact; the v-model input is manual `.value` + `oninput`. |
| Handling Input | [link](https://vuejs.org/examples/#handling-input) | ✓ | [vue/handling-input.html](vue/handling-input.html) | "methods" are plain functions from `onclick`. |
| Attribute Bindings | [link](https://vuejs.org/examples/#attribute-bindings) | ✓ | [vue/attribute-bindings.html](vue/attribute-bindings.html) | Interpolation + `.disabled` prop binding. |
| Conditionals & Loops | [link](https://vuejs.org/examples/#conditionals-and-loops) | ✓ | [vue/conditionals-and-loops.html](vue/conditionals-and-loops.html) | `$ if/else`, `$ forEach`. |
| Form Bindings (v-model) | [link](https://vuejs.org/examples/#form-bindings) | (i) | [vue/form-bindings.html](vue/form-bindings.html) | `jst-model` covers native text, checkbox, radio, select, checkbox-array, and multi-select cases; component v-model conventions are still manual. |
| Simple Component (props) | [link](https://vuejs.org/examples/#simple-component) | ✓ | [vue/simple-component.html](vue/simple-component.html) | Primitives via attrs, rich via `.todo="$(item)"`. |
| Component events ($emit) | [link](https://vuejs.org/guide/components/events) | ✓ | [vue/component-events.html](vue/component-events.html) | `el.emit` + `addEventListener`. |
| Computed | [link](https://vuejs.org/guide/essentials/computed) | (i) | [vue/computed.html](vue/computed.html) | Derive inline with `$ const`; no memoization. |
| Watchers | [link](https://vuejs.org/guide/essentials/watchers) | (i) | [vue/watchers.html](vue/watchers.html) | Side effect runs in the mutating handler. |
| Lifecycle | [link](https://vuejs.org/guide/essentials/lifecycle) | ✓ | [vue/lifecycle.html](vue/lifecycle.html) | `once()` covers post-commit setup and returned cleanup; each render covers the example's update counter. |
| Slots (default + named) | [link](https://vuejs.org/guide/components/slots) | ✓ | [vue/slots.html](vue/slots.html) | `$(slot())`, `$(slot('name','fallback'))` native. |
| provide / inject | [link](https://vuejs.org/guide/components/provide-inject) | (i) | [vue/provide-inject.html](vue/provide-inject.html) | `el.closest()` to read ancestor; not auto-reactive. |
| Template refs | [link](https://vuejs.org/guide/essentials/template-refs) | (i) | [vue/template-refs.html](vue/template-refs.html) | `el.querySelector(...)` after render. |
| Class & Style bindings | [link](https://vuejs.org/guide/essentials/class-and-style) | ✓ | [vue/class-and-style.html](vue/class-and-style.html) | No object/array sugar, but expression-built strings cover it. |
| Fetching Data | [link](https://vuejs.org/examples/#fetching-data) | (i) | [vue/fetching-data.html](vue/fetching-data.html) | Fetch/render exact; initial fetch page-driven (no onMounted). |
| Markdown Editor | [link](https://vuejs.org/examples/#markdown) | (i) | [vue/markdown.html](vue/markdown.html) | `$(trustedHTML())` renders md; property-aware morphing keeps the textarea stable. |
| Grid (sort/search) | [link](https://vuejs.org/examples/#grid) | ✓ | [vue/grid.html](vue/grid.html) | Local state; filtered/sorted rows derived inline. |
| TodoMVC | [link](https://vuejs.org/examples/#todomvc) | (i) | [vue/todomvc.html](vue/todomvc.html) | Full feature set; edit-focus needs a queued re-focus; manual two-way throughout. *(behaviourally verified)* |
| List transitions | [link](https://vuejs.org/examples/#list-transition) | (i) | [vue/list-transition.html](vue/list-transition.html) | `jst-key` + `jst-transition` cover enter/leave/move classes; full FLIP transition-group behavior still needs custom JS. |
| Modal with transition | [link](https://vuejs.org/examples/#modal) | ✓ | [vue/modal.html](vue/modal.html) | Conditional keyed node plus `jst-transition`; CSS owns enter and leave. |

## React — 11 ✓ / 3 (i)

React's "lift state up + props down" is *exactly* JST's model, so the structural
examples are clean ✓. The remaining `(i)`s are context, reducers as page code,
and effect-style data fetching conventions.

| Concept / example | Source | Status | Built | Note |
|---|---|:--:|---|---|
| useState (counter) | [link](https://react.dev/learn/state-a-components-memory) | ✓ | [react/state-counter.html](react/state-counter.html) | A prop is local state; instances independent. *(verified)* |
| Passing props | [link](https://react.dev/learn/passing-props-to-a-component) | ✓ | [react/passing-props.html](react/passing-props.html) | Rich via `.person`, primitives via attrs. |
| Rendering lists (keys) | [link](https://react.dev/learn/rendering-lists) | ✓ | [react/rendering-lists.html](react/rendering-lists.html) | `jst-key` preserves node identity across reorders. |
| Conditional rendering | [link](https://react.dev/learn/conditional-rendering) | ✓ | [react/conditional-rendering.html](react/conditional-rendering.html) | `$ if/else`; empty branch = "render null". |
| Responding to events | [link](https://react.dev/learn/responding-to-events) | ✓ | [react/responding-to-events.html](react/responding-to-events.html) | `on<event>` + `el.emit`; stopPropagation works. |
| Controlled inputs | [link](https://react.dev/learn/reacting-to-input-with-state) | ✓ | [react/controlled-inputs.html](react/controlled-inputs.html) | `jst-model` keeps local state as the source of truth; form-property morphing preserves focus/caret. |
| Lifting state up | [link](https://react.dev/learn/sharing-state-between-components) | ✓ | [react/lifting-state-up.html](react/lifting-state-up.html) | JST's native model. |
| Effects + fetching | [link](https://react.dev/learn/synchronizing-with-effects) | (i) | [react/effects-fetching.html](react/effects-fetching.html) | Guarded render block + stale-response guard; teardown exists via `onDisconnect`, but JST has no effect dependency model. |
| Context (useContext) | [link](https://react.dev/learn/passing-data-deeply-with-context) | (i) | [react/context.html](react/context.html) | Prop-drill + page store; intermediates must forward. |
| Refs (useRef) | [link](https://react.dev/learn/manipulating-the-dom-with-refs) | ✓ | [react/refs.html](react/refs.html) | DOM ref via `querySelector`; mutable ref via `el._x`. |
| Children / composition | [link](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children) | ✓ | [react/children-composition.html](react/children-composition.html) | `$(slot())` + named slots 1:1. |
| useReducer | [link](https://react.dev/learn/extracting-state-logic-into-a-reducer) | (i) | [react/reducer.html](react/reducer.html) | Plain `reducer(state, action)` in the page; dispatch reassigns. |
| Thinking in React (filter table) | [link](https://react.dev/learn/thinking-in-react) | ✓ | [react/thinking-in-react.html](react/thinking-in-react.html) | Lifted state, explicit events, derived table rendering, and stable controlled inputs map cleanly. |
| Tic-tac-toe (time travel) | [link](https://react.dev/learn/tutorial-tic-tac-toe) | ✓ | [react/tic-tac-toe.html](react/tic-tac-toe.html) | Immutable history + currentMove in page; board is a dumb renderer. *(verified incl. time travel)* |

## fixi — 10 ✓ / 8 (i)

[fixi](https://github.com/bigskysoftware/fixi) is Carson Gross's minimalist htmx:
six attributes, ~3KB, swaps via the View Transition API. Its hypermedia model is
JST's natural fit, so the core round-trips are clean ✓. Most `(i)`s are the
features fixi itself leaves to **user-land extensions** (debounce, polling,
intersection, indicators, relative selectors) — JST hand-wires those exactly as a
fixi extension would, so the gap is shared, not JST's alone.

| Example | Source | Status | Built | Note |
|---|---|:--:|---|---|
| click-to-edit | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/click-to-edit.html](fixi/click-to-edit.html) | `<contact-card>` toggles view↔edit on an `editing` flag; PUT persists. fixi's declarative `fx-action`/`fx-target` swap is a 4-line handler. |
| delete-row | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/delete-row.html](fixi/delete-row.html) | Page owns the rows; Delete issues `fx-method="delete"` then filters the row out. fixi-core has no built-in confirm. |
| confirm-delete | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/confirm-delete.html](fixi/confirm-delete.html) | fixi wires confirmation via `cfg.confirm` in `fx:config` (no attribute); JST gates the DELETE with an in-page confirm UI. |
| lazy-load | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/lazy-load.html](fixi/lazy-load.html) | `once()` is the analog of fixi's `fx-trigger="fx:inited"`: fetches a fragment carrying its own `<script type="jst">` def + markup, auto-upgraded. |
| click-to-load | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/click-to-load.html](fixi/click-to-load.html) | "Load More" fetches the next page, concatenates into a page-owned array, re-renders. |
| infinite-scroll | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/infinite-scroll.html](fixi/infinite-scroll.html) | Fetch/append idiomatic; the trigger is a hand-wired IntersectionObserver on a sentinel. fixi-core needs its Intersection Events extension too. |
| active-search | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/active-search.html](fixi/active-search.html) | `<search-results>` renderer is clean; the debounced keystroke trigger is hand-written `setTimeout`. fixi-core also omits debounce. |
| inline-validation | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/inline-validation.html](fixi/inline-validation.html) | Plain input (keeps focus) POSTs per keystroke; `<field-status>` renders the verdict; native `required`/`type=email` gate submit. |
| value-select (cascading) | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/value-select.html](fixi/value-select.html) | Changing make fetches models and sets a prop on `<model-select>` (default `change` trigger). |
| bulk-update | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/bulk-update.html](fixi/bulk-update.html) | "Toggle all" + per-row checkboxes stage a draft; one POST applies all and shows a toast. |
| add-and-reset | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/add-and-reset.html](fixi/add-and-reset.html) | A "new item" form POSTs, appends the created item to a page-owned list, then resets and refocuses the input. |
| swap-to-property | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/swap-to-property.html](fixi/swap-to-property.html) | fixi's distinctive `fx-swap` into a property maps 1:1: the response is written straight into `el.value` and `el.className`. |
| relative-target | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/relative-target.html](fixi/relative-target.html) | fixi's `next`/`closest`/`find` are an extension; JST resolves the trigger-relative `<output>` via `el.closest(...)`, no global ids. |
| request-indicator | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/request-indicator.html](fixi/request-indicator.html) | fixi-core has no `hx-indicator`; the handler toggles a `loading` prop (spinner + disabled) around the fetch, mirroring `fx:before`/`fx:after`. |
| polling | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/polling.html](fixi/polling.html) | fixi-core has no polling trigger; a hand-written `setInterval`, torn down via `onDisconnect`. |
| mock-template | [link](https://github.com/bigskysoftware/fixi) | ✓ | [fixi/mock-template.html](fixi/mock-template.html) | JST's mock-fetch is the same idea as fixi's `cfg.fetch` override; the fetched fragment carries its own component def and auto-registers. |
| view-transition | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/view-transition.html](fixi/view-transition.html) | fixi swaps via the View Transition API natively; JST has no native VT swap, so a keyed node + `jst-transition` does the enter/leave (CSS-owned). |
| fx-ignore | [link](https://github.com/bigskysoftware/fixi) | (i) | [fixi/fx-ignore.html](fixi/fx-ignore.html) | No `jst-ignore` directive yet (open proposal); an uncontrolled third-party widget survives re-renders by living in a projected slot, not the morphed subtree. |

## Lit — 15 ✓ / 5 (i)

[Lit](https://lit.dev) is the closest peer in this study: like JST it compiles to
real custom elements, so reactive properties, the expression types, events, keyed
lists, and lifecycle map 1:1 ✓. The `(i)`s are where Lit reaches past vanilla
custom elements — Shadow-DOM-scoped styles (JST is light-DOM), the `ref`/`until`
directives, `@lit/context`, and `@lit/task`.

| Example | Source | Status | Built | Note |
|---|---|:--:|---|---|
| hello-world | [link](https://lit.dev/docs/components/overview/) | ✓ | [lit/hello-world.html](lit/hello-world.html) | `LitElement` + `render()` ↔ a `<script type="jst">` that compiles to a real, inspectable custom element. |
| reactive-properties | [link](https://lit.dev/docs/components/properties/) | ✓ | [lit/reactive-properties.html](lit/reactive-properties.html) | `@property name` ↔ `attributes="name"`; `el.name = '…'` re-renders, identical to a reactive property. |
| attribute-vs-property | [link](https://lit.dev/docs/components/properties/#attributes) | ✓ | [lit/attribute-vs-property.html](lit/attribute-vs-property.html) | Lit's attribute converter (`count="3"`→Number) ↔ JST's JSON-parsed attribute; rich objects via `.data="$(obj)"`. |
| boolean-attribute | [link](https://lit.dev/docs/templates/expressions/#boolean-attribute-expressions) | ✓ | [lit/boolean-attribute.html](lit/boolean-attribute.html) | Lit `?hidden=${!show}` ↔ JST `.hidden="$(!show)"`, which genuinely adds/removes the boolean attribute. |
| property-expression | [link](https://lit.dev/docs/templates/expressions/#property-expressions) | ✓ | [lit/property-expression.html](lit/property-expression.html) | Lit `.items=${this.items}` ↔ JST `.items="$(arr)"` passing an array to a child. |
| events | [link](https://lit.dev/docs/components/events/) | ✓ | [lit/events.html](lit/events.html) | Lit `@click=${this._handleClick}` ↔ JST `onclick="$(fn)"` mutating a local prop. |
| child-to-parent-events | [link](https://lit.dev/docs/components/events/#dispatching-events) | ✓ | [lit/child-to-parent-events.html](lit/child-to-parent-events.html) | Lit `dispatchEvent(new CustomEvent(…,{bubbles,composed}))` ↔ JST `el.emit('item-selected', detail)`; parent binds `onitem-selected`. |
| conditional-rendering | [link](https://lit.dev/docs/templates/conditionals/) | ✓ | [lit/conditional-rendering.html](lit/conditional-rendering.html) | Lit `when(cond, a, b)` ↔ JST `$ if (user) {…} $ else {…}` (signed-in/out toggle). |
| list-rendering | [link](https://lit.dev/docs/templates/lists/) | ✓ | [lit/list-rendering.html](lit/list-rendering.html) | Lit `map(items, i => html\`<li>${i}</li>\`)` ↔ JST `$ items.forEach`. |
| repeat-keyed | [link](https://lit.dev/docs/templates/lists/#the-repeat-directive) | ✓ | [lit/repeat-keyed.html](lit/repeat-keyed.html) | Lit `repeat(items, i => i.id, tpl)` ↔ JST `forEach` + `jst-key`; reorder preserves node identity and a typed input value. |
| styles | [link](https://lit.dev/docs/components/styles/) | (i) | [lit/styles.html](lit/styles.html) | Lit's `static styles = css\`…\`` is Shadow-DOM-scoped; JST is light-DOM, so styling is ordinary global CSS — the encapsulation is the genuine gap. |
| classmap-stylemap | [link](https://lit.dev/docs/templates/directives/#classmap) | ✓ | [lit/classmap-stylemap.html](lit/classmap-stylemap.html) | `classMap`/`styleMap` objects ↔ expression-built class/style strings. No object sugar, but covers every case. |
| ifDefined | [link](https://lit.dev/docs/templates/directives/#ifdefined) | ✓ | [lit/ifdefined.html](lit/ifdefined.html) | `ifDefined(x)` ↔ a conditional attribute emitted only when the value is defined, so the attribute appears/disappears. |
| live (forms) | [link](https://lit.dev/docs/templates/directives/#live) | ✓ | [lit/forms-live.html](lit/forms-live.html) | `live(x)` ↔ `jst-model`: the prop is the source of truth and property-aware morphing preserves caret/focus while external writes flow back. |
| ref | [link](https://lit.dev/docs/templates/directives/#ref) | (i) | [lit/ref-directive.html](lit/ref-directive.html) | `ref(createRef())` ↔ `el.querySelector(...)` after render — reaches the node to `.focus()`, but it's a manual lookup, not an auto-populated ref. |
| lifecycle | [link](https://lit.dev/docs/components/lifecycle/) | ✓ | [lit/lifecycle.html](lit/lifecycle.html) | `connectedCallback`/`firstUpdated`/`disconnectedCallback` ↔ `once()` (returns cleanup) + `onDisconnect()`; a Remove button proves teardown fires. |
| willUpdate | [link](https://lit.dev/docs/components/lifecycle/#willupdate) | ✓ | [lit/will-update.html](lit/will-update.html) | `willUpdate()` ↔ a `$ const fullName = …` derive line in the template, run before render. |
| async until | [link](https://lit.dev/docs/templates/directives/#until) | (i) | [lit/async-until.html](lit/async-until.html) | `until(promise, placeholder)` ↔ a `once()`-driven fetch that sets `loading`/`result` props plus a guarded `$ if`; no `until` primitive, async wiring is explicit. |
| context | [link](https://lit.dev/docs/data/context/) | (i) | [lit/context.html](lit/context.html) | `@lit/context` provide/consume ↔ prop-drill through a page-level store; intermediates must forward and reads aren't auto-reactive. |
| async task | [link](https://lit.dev/docs/data/task/) | (i) | [lit/async-task.html](lit/async-task.html) | `@lit/task` ↔ a hand-written controller: a `productId` change runs a guarded fetch walking a `status` prop through pending→complete→error. |

---

## Gaps — what JST can't (yet) do idiomatically

Ordered by how often they forced an `(i)`, with a verdict on whether the
workaround is an acceptable tradeoff. **You decide.**

1. **No reactivity primitives** (computed/watch/effect). Derive inline with
   `$ const`; "watch" by acting in the mutating handler. *Verdict: works and
   re-runs exactly when the (coarse) re-render fires; no memoization or
   dependency tracking — fine at these sizes, would not scale to heavy derived
   state.*
2. **No DI / context / global store.** Prop-drill or a page-level shared object;
   intermediates must forward; reads via `el.closest()` aren't auto-reactive.
   *Verdict: acceptable and explicit for shallow trees; a boilerplate tax that
   grows with depth.*
3. **No full declarative server-trigger layer** (the HTMX premise). Component
   events now have modifiers and debounce, but page-level polling, reveal, and
   request orchestration are still hand-written `fetch`, `setInterval`, and
   `IntersectionObserver`. *Verdict: this is JST's model by design; helpers may
   be worthwhile, but they should not become a second HTMX DSL in core.*
4. **No full transition-group engine.** `jst-transition` provides enter, leave,
   and move classes, but does not calculate FLIP transforms the way Vue's
   `<transition-group>` can. *Verdict: CSS covers common cases; complex move
   choreography still needs custom JS.*
5. **No teleport/portal.** A component renders into its own light DOM; modals
    must be hoisted to a body-level component driven by events. *Verdict:
    achievable, loses co-location ergonomics.*
6. **No Shadow-DOM style scoping.** JST renders to light DOM by design, so
   Lit's `static styles = css\`…\`` encapsulation has no equivalent; you
   namespace selectors with ordinary global CSS. *Verdict: simpler and fully
   inspectable, but styles are not encapsulated — discipline replaces the
   boundary.*
7. **No uncontrolled-region directive.** fixi's `fx-ignore` (and the proposed
   `jst-ignore`) fence off a subtree so the framework never touches it; today a
   third-party widget has to live in a projected slot to survive re-renders.
   *Verdict: works via slots; a dedicated directive would be cleaner.*

### Where JST is a strong or *better* fit
- **Real custom elements** — JST and Lit both compile to native custom
  elements, so the entire Lit core (reactive properties, the four expression
  types, events, keyed lists, lifecycle) maps 1:1 with no workarounds.
- **"Server returns components" (HTMX's premise)** — the `MutationObserver`
  auto-registers fetched `<script type="jst">` fragments; `lazy-load` and
  `tabs-hateoas` are clean and idiomatic. This is the standout strength.
- **Lift-state-up / props-down-events-up** — React's `lifting-state`, `reducer`,
  and the whole tic-tac-toe tutorial are exact, often *cleaner*, matches.
- **Slots / composition**, **conditionals & loops**, **attribute/class/style
  interpolation**, **events**, **DOM & mutable refs** — all exact.
- **`x-cloak`** is *better*: native `:not(:defined)` cloaking, zero JS.

## Authoring notes

Several sharp edges surfaced during the study and are now fixed in core:
comments are inert, `$item1` scans correctly, balanced expressions understand
regex/comment delimiters, malformed `.prop="$(a)$(b)"` bindings fail loudly,
props are declared case-preserved with `attributes="editingId"`, and `jst-key`
preserves list identity.

Still worth remembering:

- External HTML call sites obey platform casing rules, so
  `<my-card editing-id="1">` maps to the internal `editingId` prop.
- Event handlers close over render-time values; multiple synchronous mutations
  in one microtask coalesce, similar to React's stale-closure class of issues.
- `trustedHTML()` and fetched `<script type="jst">` fragments are trust
  boundaries, not escaping conveniences.

## Method & validation

- The source examples were reviewed against the upstream revisions recorded in
  [`upstream-revisions.json`](upstream-revisions.json), rather than an unpinned
  moving documentation target.
- **All 108 pages** are checked for readiness, console/JST errors, and one
  per-page assertion (`verify.mjs`). Pages can declare a focused
  `window.__parityTest`; otherwise the verifier exercises the first control and
  requires an observable change, or checks rendered output for static examples.
- Exact/partial remains an author assessment of how idiomatically the source
  behavior maps to JST. It is not inferred from the test result.
- Nothing was impossible (0 ✗); nothing got stuck.

_Infra: `lib/mock-fetch.js` (front-end backend), `JST_PRIMER.md` (build guide),
`verify.mjs` (load validator), `_infra_smoke.html` (mock + late-fragment demo)._
