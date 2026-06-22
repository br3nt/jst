# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
