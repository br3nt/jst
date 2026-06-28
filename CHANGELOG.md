# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.4.1 - 2026-06-28

Additive — **no breaking changes**.

### Added

- **`view-transition` attribute.** Put it on a component *instance*
  (`<my-list view-transition>`) to wrap that instance's re-renders in the
  browser's View Transition API. It's a usage-site, **per-instance** choice (the
  consumer's presentation decision) — the component template is unchanged. The
  first paint is never animated; it degrades to an instant render where the API
  is unsupported. Style with `::view-transition-*` CSS. See
  `examples/view_transition_component.html` (and `examples/view_transitions.html`
  for a from-scratch explainer of View Transitions).
- **`docs/from-other-frameworks.md`** — an explicit "other frameworks do X; in
  JST you do Y" map: shared store / context → pass via **attributes**; refs →
  `el.querySelector`; component two-way → explicit `.attr` + event (`jst-model`
  stays for native inputs only); `computed`/`effect`/`watch` → cheap inline, pass
  the value in, or `once()` (expensive derivation is business logic — keep it out
  of templates); `fx-ignore`/`x-ignore` → wrap the widget in a component + project
  via a slot; scoped styles → light DOM + global CSS.

### Changed

- **Framework parity:** `fixi/fx-ignore` (i)→✓ — encapsulating a third-party
  widget behind a component interface and projecting its DOM via a slot (preserved
  across re-renders) is the idiomatic pattern, not a workaround. **fixi now 18/0.**
- **Closed the `jst-ignore` proposal (#6):** a slot already gives the uncontrolled
  region (projected nodes are moved, not re-rendered), so no directive is needed.

## 0.4.0 - 2026-06-28

The directive release: two opt-in libraries of declarative, string-valued
attributes for *usage* HTML — `jst-nav` (server-driven nav) and `jst-behaviors`
(client behaviors) — plus a reverse-infinite-scroll pattern. **Additive; no
breaking changes** (new opt-in files; nothing to migrate).

### Added

- **`jst-nav`** — HTMX/fixi-shaped server-driven navigation: `jst-get` /
  `jst-action` + the native `method` attribute (verbs), `jst-target` (100% CSS
  selectors: bare / `this` / `closest` / `find` / `closest…find`), `jst-swap`
  (innerHTML / outerHTML / insert-adjacent / delete / none / morph / transition,
  + out-of-band via `jst-swap-oob`), `jst-select`, `jst-push-url` + history,
  `jst-boost`, `jst-confirm`, error routing (`jst-target-4xx`/`-5xx`), and
  `jst-trigger` (`load` / `revealed` / `every Ns` / `keyup changed delay:Nms` /
  key-filtered `keydown[Shift+D] from:body`). In-flight requests abort on
  re-trigger; a `jst-request` class marks the trigger during the fetch.
- **`jst-behaviors`** — Alpine-shaped client behaviors for what the platform
  doesn't give free: `jst-intersect` (reveal / lazy media) and `jst-teleport`
  (portal). (Toggle / dismiss / outside-click are native — Invoker Commands +
  Popover + `<dialog>`.)
- **Reverse infinite scroll** — `jst-swap="afterbegin"` prepends older content
  and preserves scroll position (`examples/jst_nav.html`).
- **Builds** — minified `jst-nav.min.js` (~7.5 KB) + `jst-behaviors.min.js`
  (~2.2 KB) as opt-in add-ons that work with any core build.
- **`docs/directives.md`** — the directive reference.

### Changed

- **Framework parity: every directive-addressable partial is now an exact ✓** —
  HTMX 16/0, fixi 17/1 (only `fx-ignore`, proposal #6), alpine `x-teleport`. The
  corpus moves to **102 exact / 24 partial / 126**. The remaining `(i)`s
  (alpine ref/effect/store/watch, most Vue, some React/Lit) are inherent
  fine-grained-reactivity / framework-feature differences, not directive gaps.

## 0.3.0 - 2026-06-28

A breaking release: the template input keyword is renamed `props=` → `attributes=`.
Also lands first-class Invoker Commands support, an opt-in component-library
**preview** (`jst-layout` + `jst-components`), and three more frameworks in the
parity study (Svelte, Solid, Angular).

### Changed (breaking)

- **The template input declaration `props="…"` is renamed to `attributes="…"`**,
  with `attrs="…"` accepted as a shorthand alias. A template's inputs *are* HTML
  attributes; the new name says so (and sheds the React-flavoured "props"). The
  old `props="…"` is **removed with no alias** — a template still using it throws
  a clear, actionable error. Invalid-identifier and reserved-name errors now say
  "attribute" instead of "prop".

  **Migration** — rename the one keyword on every template *definition*:

  | 0.2.x | 0.3.0 |
  | --- | --- |
  | `<script type="jst" name="todo-item" props="item onToggle">` | `<script type="jst" name="todo-item" attributes="item onToggle">` |

  Nothing else changes: usage sites (`<todo-item item="…">`), `.prop="$(…)"`
  property bindings, and `on<event>` handlers are unaffected. `npm run lint` flags
  any leftover `props=` on a `<script type="jst">` open tag with `file:line:col`.

### Added

- **Invoker Commands API support (#29).** `command`/`commandfor` and custom
  `--commands` work across the JST boundary with **no new core code**: `oncommand`
  rides the existing `on*` → `addEventListener` binding. Custom-command events
  fire on the `commandfor` target (`bubbles: false`); for events up to a parent,
  the target re-emits via `el.emit()`. Verified across multiple instances with no
  synthetic id system. See `examples/invoker_commands.html`.
- **Component-library preview (opt-in, CSS-first).** `jst-layout.css` (design
  tokens + classless base + layout primitives) and `jst-components.css`
  (Modal/Accordion/Dropdown/Tabs/Toast/Combobox/Table + theme skins), with a
  "which JST tech?" badge and a 10-framework re-skin demo
  (`examples/components_cross_section.html`). **Preview** — not yet packaged for
  distribution.
- **Framework-parity expansion.** Svelte, Solid, and Angular added to the study
  (18 JST reimplementations) — now **9 frameworks / 126 examples**.

### Tooling

- `tools/lint.mjs` gains an open-tag rule that statically flags the removed
  `props=` keyword on a `<script type="jst">` tag.

## 0.2.3 - 2026-06-24

Adds the runtime-only builds (no compiler) for precompiled deployments, a
`--global` precompile target to match, and a full "which build, and when" guide.
No breaking changes (patch bump).

### Added

- **Runtime-only builds — `jst.runtime.js` (ESM) and `jst.runtime.global.js`
  (+ `.min`, classic).** Same runtime as the full builds with the compile
  pipeline omitted (`compiler`/`parser`/`lexer`/`interpreter`/`tokens`/
  `input_reader`), for apps whose templates are precompiled. About **40% smaller**
  (~16.6 KB vs ~28.2 KB minified) and inherently strict-CSP — no `new Function`.
  They render only precompiled templates; an inline `<script type="jst">` that
  reaches them throws a clear "precompile this" error. (#5)
- **`precompile.mjs --global`** — emits a classic script that reads
  `window.JST.registerPrecompiledTemplate` (no ES import), to pair with
  `jst.runtime.global.js` for a no-build/`file://` precompiled drop-in. The
  default ESM output now recommends `--runtime ./jst.runtime.js`.
- **`examples/runtime_precompiled.html`** — browser smoke-tested page loading the
  runtime-only global build with a precompiled template.

### Docs

- A full delivery-modes guide in `install.md`: the four client builds
  (full/runtime-only × ES-module/classic) with a quick chooser, a
  Precompiled + runtime-only section, and a table disambiguating the **two build
  tools** — `precompile.mjs` (compiles *your* templates) vs `build_global.mjs`
  (bundles *the framework*). `production.md` documents the prod-and-dev
  "server compiles, client renders" workflow; `known-gaps.md` and README updated.

## 0.2.2 - 2026-06-24

Adds the classic/global build so JST runs with no server (and from `file://`),
fixes a latent bug in the inlined standalone demo, and documents the delivery
modes. No breaking changes (patch bump).

### Added

- **`jst.global.js` + `jst.global.min.js` — classic/global build.** The whole
  runtime concatenated into one non-module script that exposes `window.JST` and
  self-initializes. Because it has no `import` statements it loads from `file://`
  with no server and no build step — for prototypes, copied/generated single
  files, and one-line CDN drop-ins. Built from the module sources by
  `npm run build` (`tools/build_global.mjs`); a `build:check` mode in CI keeps the
  committed artifacts in sync with `jst.js`. Both ship on npm and as release
  assets. (file-open mode, previously listed as planned)
- **`examples/global_build.html`** — a browser smoke-tested page that loads the
  global build via a plain `<script src>` and renders a component.

### Fixed

- **`concerns-standalone.html` was broken at runtime.** The hand-assembled inline
  bundle stripped `import * as Tokens from './tokens.js'` without re-creating a
  `Tokens` object, so the lexer threw `ReferenceError: Tokens is not defined` as
  soon as it tokenized a template — the "open directly from `file://`" demo never
  worked. It is now regenerated from the modules by the build (which emits the
  namespace shim) and covered by a functional test.

### Docs

- **Delivery modes** (ES module / global build / precompiled), the global build,
  `file://` usage, CDN pinning, and dev-vs-prod serving documented in
  `install.md`, with `production.md` and `known-gaps.md` updated to match
  (file-open mode marked shipped).

## 0.2.1 - 2026-06-24

Follow-up release from upgrading a real server-rendered app to v0.2. Fixes a
correctness gap in initial-load template resolution, ships migration tooling so a
breaking-syntax leftover fails the build instead of a browser render, exposes the
runtime version, and fills two doc gaps. No breaking changes (patch bump).

### Fixed

- **`resolveTemplate` now resolves components already in the initial HTML.**
  Auto-init runs at module eval — before an importing module can call
  `configure({ resolveTemplate })` — so components present in the server-rendered
  HTML were scanned while the resolver was still `null` and silently never
  upgraded (only later-injected components worked, via the observer). `configure()`
  now re-runs the missing-template scan when a resolver is set after init. The scan
  is idempotent (it ignores already-registered names and coalesces in-flight
  fetches), so this is safe and cheap. Consumers can delete the eager
  fetch-and-register workaround. (#21)

### Added

- **`tools/codemod.mjs` (`jst-codemod`)** — mechanical `@event` → `on<event>`
  migration that rewrites bindings only inside `<script type="jst">` blocks
  (preserving modifiers and the `$(...)` value), so it is safe to run over server
  views and fragments without touching `@media`, decorators, emails, or
  other-framework `@click`. `--dry-run` previews. (#22)
- **`tools/lint.mjs` (`jst-lint`)** — scans every `<script type="jst">` block
  across any file type for removed/renamed syntax (`@event`, `raw()`,
  `unsafeHTML()`, `document.jst`) and exits non-zero with `file:line:col`, turning
  a render-time-only failure into a build/CI failure. `--runtime jst.js` also
  flags a stale vendored runtime (`jst-ssr`/`document.jst`). Dogfooded over JST's
  own surfaces via `npm run test:lint`. (#22)
- **`JST.version`** — the loaded runtime version as an ES export (`import { version }`)
  and on `window.JST`, sourced from `package.json` and kept honest by a drift test.
  With `configure({ dev: true })` the runtime also logs `JST x.y.z` once on load,
  so confirming an upgrade (vs. a stale cache that renders identically) is a
  one-liner. (#23)

### Docs

- **Serving and caching the no-build assets** — dev `Cache-Control: no-cache`,
  prod fingerprint/version — in `install.md`, to preempt stale-asset confusion. (#24)
- **Server-rendered initial data and large payloads** — JSON attribute for small
  structured data; a `<script type="application/json">` sidecar read in `once()`
  (or slot projection) for large/newline-heavy payloads — in `writing-jst.md`. (#24)
- **Upgrading across breaking releases** and **Which version is live** sections in
  `install.md` documenting the codemod, lint, and `JST.version`.

## 0.2.0 - 2026-06-23

Breaking cleanup release. Event-handler syntax moves to the native `on<event>`
form, the trusted-HTML helper is consolidated to a single name, the `document.jst`
global is removed in favour of the ES-module exports plus a reduced `window.JST`,
and the unrequested `jst-ssr` adoption feature is removed because it contradicts
JST's rendering model (the server ships a component fragment + data; the client's
`jst.js` is the sole renderer — nothing pre-rendered is inserted into the DOM).
Major stays `0`; per 0.x semantics the breaking changes bump the minor.

### Changed (breaking)

- **Event handlers use `on<event>` instead of `@event`.** `@click="$(fn)"` becomes
  `onclick="$(fn)"`; modifiers are retained on the new name
  (`onclick.stop`, `onkeydown.enter.prevent`, `onsubmit.prevent`,
  `oninput.debounce.300`, `onclick.outside`, `onclick.once`). The value must still
  be exactly one `$(...)` expression. Leftover `@event="$(...)"` now throws a
  compile error pointing at the `on<event>` replacement.
- **Raw inline JavaScript in `on*` attributes is rejected.** An `on*` handler whose
  value is not a single `$(...)` expression (e.g. `onclick="alert(1)"`) is a
  compile error, so a JST `on*` handler can never silently become a native inline
  handler.
- **`on*` is reserved for event handlers; the event name must start with a
  letter.** An `on…="$(...)"` attribute whose event name does not start with a
  letter (e.g. `on3d-ready`, `on-foo`) now throws a clear compile error — and is
  flagged in the VS Code editor (diagnostics run the real compiler) — instead of
  silently degrading to a literal attribute (#19).

### Removed (breaking)

- **`raw()` and `unsafeHTML()` helpers.** Use `trustedHTML()` — now the only
  opt-out-of-escaping helper. The render-function helper signature drops `raw`/
  `unsafeHTML`; precompiled output is regenerated accordingly.
- **`document.jst`.** State now lives in the module; the ES-module exports are
  canonical and a **reduced `window.JST`** global mirrors them (`configure`,
  `trustedHTML`, `url`, `registerCustomElementFromTemplate`,
  `registerPrecompiledTemplate`, `initializeTemplates`, and the live `config`).
  `window.JST` no longer exposes `raw`, `unsafeHTML`, or `templates`.
- **`jst-ssr` / SSR adoption.** The `#hydrating` field and all `jst-ssr` handling
  are gone (slot capture/observe and slot detach are unconditional again). The SSR
  hydration test, the "SSR hydration plus projected slots" known-gap, and the SSR
  claims in the precompile note and docs are removed. Passing trusted rendered
  content (e.g. markdown) as an attribute placed with `trustedHTML(...)` is still
  legitimate — that is data on an attribute, not pre-rendered UI structure.

### Added

- **Light-DOM id-collision guidance.** `docs/writing-jst.md` gains a worked
  "Avoiding id collisions in the light DOM" section (prefer classes + scoped
  `el.querySelector`; derive a unique per-instance id for `label for`/`aria-*`),
  and `docs/known-gaps.md` links to it.
- **Standalone-openable landing examples.** Each embedded example on `index.html`
  has a prominent, keyboard- and screen-reader-accessible **"Open standalone ↗"**
  action so it can be interacted with, inspected in DevTools, and view-sourced on
  its own page, without the iframe scroll/interactivity trap.

### Fixed

- **Nested `.prop` propagation on a parent morph (regression-tested).** When a
  parent re-renders (including via `setAttribute`, the morph-by-attribute pattern),
  data passed to a nested managed child via a `.prop="$(expr)"` binding now
  provably flows into the child's props — `morphNode` syncs the fresh binding
  markers onto the existing managed child before its early return, and the parent's
  whole-subtree binding pass re-applies them. New runtime tests cover the
  string/object `setAttribute` path and a router-parent-delegating-to-child case,
  and a load-bearing comment documents why the order must not change.
- **`on*`/`.prop` sequences in template text are no longer misread as bindings.**
  Binding detection is now gated to genuine tag-attribute position (tracking
  tag/quote state, so a `>` inside an earlier attribute value doesn't defeat a
  later binding), so prose like `online="$(x)"` in text content is left as literal
  text instead of binding a spurious `line` event or erroring (#19).

### Migration (old → new)

| Old (0.1.0) | New (0.2.0) |
|---|---|
| `@click="$(fn)"` | `onclick="$(fn)"` |
| `@keydown.enter.prevent="$(fn)"` | `onkeydown.enter.prevent="$(fn)"` |
| `@submit.prevent` / `@click.outside` / `@click.once` | `onsubmit.prevent` / `onclick.outside` / `onclick.once` |
| `@my-event="$(fn)"` (custom event) | `onmy-event="$(fn)"` |
| `onclick="doThing()"` (raw inline JS — was silently a native handler) | `onclick="$(doThing)"` (must be one `$(...)`) |
| `$(raw(x))` / `$(unsafeHTML(x))` | `$(trustedHTML(x))` |
| `document.jst.configure({...})` | `import { configure } from './jst.js'` — or `window.JST.configure({...})` |
| `document.jst.config` | `window.JST.config` (or the `config` returned by `configure`) |
| `window.JST.raw` / `window.JST.unsafeHTML` / `window.JST.templates` | removed — use `trustedHTML` / ES imports |
| `<my-cmp jst-ssr>…server HTML…</my-cmp>` | removed — send the component fragment + data (`<my-cmp …></my-cmp>`) and let `jst.js` render it |

## 0.1.1 - 2026-06-21

### Changed

- **`once()` runs after the DOM commits.** The template body runs as a
  string-build pass before the rendered DOM and projected slots exist, so
  `once()` setup that touched the component's own DOM ran too early. Setup is now
  deferred to a microtask that runs after the render commits. The function setup
  returns is registered as disconnect cleanup, so hosting a third-party widget is
  `once('key', () => mount(el))` with no manual teardown wiring. A per-connection
  epoch discards a stale setup across a synchronous disconnect then reconnect.

### Documentation

- **Lifecycle and `once()` timing.** The string-build vs commit model, inline
  `${ ... }` vs `once()`, and hosting a third-party widget through a slot so the
  morpher never recreates its nodes.
- **Component granularity.** Guidance on when not to make a component: inline a
  library rather than wrap it in a slot-only component, and server-render a
  static surface with a module instead of a component.
- **Known gaps.** Calling module code from a template currently needs a global,
  and there is no uncontrolled-region directive for template-generated widget
  hosts.


## 0.1.0 - 2026-06-17

First release: a fail-loud, no-build component model with a real reconciler, a
proper lifecycle, a strict-CSP production path, and a HATEOAS-first story. This
release integrates two parallel hardening efforts into one runtime.

### Added

- **`props="..."` declaration model.** Components declare their inputs explicitly
  via a `props` attribute (case-preserved) instead of inferring them from bare
  attributes. Fixes reserved attribute-name collisions (`class`, `id`, `style`)
  and the camelCase/kebab-case mismatch between HTML attributes and template
  variables. Reserved/helper names (`class`, `el`, `raw`, JS keywords) are
  rejected at compile time.
- **Keyed reconciliation via `jst-key`.** List rendering matches nodes by key
  across updates, preserving element identity, DOM state, focus, and listeners
  instead of rebuilding the subtree (incl. reorder, mixed keyed/unkeyed siblings,
  nested keyed lists, table rows, SVG).
- **Property-aware, focus-safe form morphing.** Updates patch live properties
  (`value`, `checked`, `selected`) rather than attributes; controlled
  (template-declared) values win, uncontrolled fields keep user state, and focus
  and caret/selection survive unrelated re-renders.
- **CSS transitions via `jst-transition`** (Vue-style enter/leave classes; the
  framework toggles classes and timing, CSS animates; leave waits for
  `transitionend` with a fallback).
- **Dynamic slots.** Default, named, and late-inserted slot content project
  correctly (`$(slot())` / `$(slot('name', 'fallback'))`).
- **Lifecycle hooks `once()` and `onDisconnect()`** for one-time setup and
  teardown on disconnect (incl. document-listener cleanup for `@event.outside`).
- **`@event` modifiers:** `.prevent .stop .self .once .capture .passive`, key
  guards, `.debounce[.ms]`, and `.outside` (document-level, cleaned up on
  disconnect).
- **`jst-model` local form sugar.** Binds a control to the component's own host
  property (read `el[prop]`, write `el[prop]` on input) - local component-owned
  UI state. Parent/server-owned state stays explicit with `.value` + emitted
  events, keeping the boundary props-down / events-up.
- **`url()`, `raw()` / `unsafeHTML()` helpers** for URL-scheme sanitizing and
  explicit, opt-in raw HTML insertion.
- **Trust-boundary configuration.** `document.jst` / `window.JST` expose
  `configure`, helpers, and registration. `configure({ dev, autoRegister,
  autoRegisterRoot, resolveTemplate })` controls dev errors, fragment
  auto-registration, its scope, and lazy template resolution. With
  `autoRegister: false`, inserted `<script type="jst">` are ignored but a trusted
  `resolveTemplate` allowlist can still resolve missing components.
- **Precompiled / strict-CSP mode.** `tools/precompile.mjs` compiles templates to
  a plain ES module (no `new Function`) that registers through the normal runtime
  (`registerPrecompiledTemplate`), so morphing, keyed reconciliation, form-state,
  and modifiers are all preserved under `script-src 'self'`.
- **Dev-mode error overlay** (`.jst-error`) and contained, fail-loud render/compile
  errors.
- **HATEOAS service-worker demo** (`demo/hateoas/`) - HTML fragments that carry
  their own auto-registering `<script type="jst">` definitions.
- **CI** (`.github/workflows/ci.yml`): node + browser + examples + parity +
  agentic + VS Code tooling, with a real Chrome gate via `CHROME_PATH`.

### Fixed

- **Post-commit `once()` setup.** Lifecycle setup now runs in a microtask after
  rendered DOM is committed, skips setup if the element disconnects first, and
  still registers a returned disconnect cleanup.
- **Fail-loud lexer/compiler.** Malformed bindings throw at compile time instead
  of silently degrading - including `.prop`/`@event` values with more than one
  `$(...)` expression or literal text around the expression. Compile errors are
  contained to the offending component rather than taking down the page.
- **JS-token-aware scanner.** `$(...)` / `${...}` and the `$ line` directive skip
  strings, template literals (with nested `${}`), regexes, and comments;
  regex-vs-division and `<`-tag-vs-less-than are resolved by the previous
  significant token. Identifiers with trailing digits (`$item1`) lex correctly.
- **Inert HTML comments.** `<!-- ... -->` content is ignored by the compiler and
  never treated as a binding.
