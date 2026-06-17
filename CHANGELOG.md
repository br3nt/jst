# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **SSR hydration via `jst-ssr`.** Server-rendered markup is adopted and hydrated
  in place rather than discarded and re-rendered.
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
  SSR, and modifiers are all preserved under `script-src 'self'`.
- **Dev-mode error overlay** (`.jst-error`) and contained, fail-loud render/compile
  errors.
- **HATEOAS service-worker demo** (`demo/hateoas/`) - HTML fragments that carry
  their own auto-registering `<script type="jst">` definitions.
- **CI** (`.github/workflows/ci.yml`): node + browser + examples + parity +
  agentic + VS Code tooling, with a real Chrome gate via `CHROME_PATH`.

### Fixed

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
