# PR Review Description: JST Roadmap Implementation

Branch/worktree: `codex-jst-roadmap` in `/Users/brent/Development/jst-codex-roadmap`

This branch is my implementation pass over the JST review/roadmap discussion. The goal was not only to fix the obvious bugs, but to push JST toward a coherent production story: controlled components, explicit trust boundaries, runtime and precompiled modes, and a much harsher morphing test suite.

## Summary

This branch changes the public authoring API, hardens the parser/runtime, expands directives, adds a production/precompile path, updates examples and parity pages, and adds a reviewer-facing concerns lab.

The highest-impact changes are:

- Replaced attribute-name-based params with case-preserved `props="item onToggle name"` declarations.
- Fixed the `name` prop bug and the camelCase/lowercasing trap.
- Hardened the lexer/parser for `$identifier` with digits, regex/comment delimiters inside `$(...)`, HTML comments, and malformed `.prop="$(a)$(b)"` bindings.
- Added keyed morphing, form-property morphing, transition phases, event modifiers, `jst-model`, slots that handle later child insertion, dev render errors, lazy template resolution, and precompiled template registration.
- Added trust-boundary controls: `autoRegister`, `autoRegisterRoot`, `resolveTemplate`, `raw()` / `unsafeHTML()`, and `SECURITY.md`.
- Added package metadata, docs, precompiler CLI, and updated VS Code diagnostics/providers/tests.
- Migrated examples and framework parity pages to the new `props` API.
- Added `concerns.html` and `concerns-standalone.html` to demonstrate design checks, real problems, trust boundaries, and recommended patterns.
- Added adversarial morph coverage across keyed lists, forms, transitions, tables, SVG, slots, and nested custom elements.

## Important Design Decisions

### Props declaration

The new model is:

```html
<script type="jst" name="todo-item" props="item onToggle name">
  <button @click="$(onToggle)">$(item.text)</button>
</script>
```

Why:

- Attribute names are lowercased by HTML, so `thisMightNotWork` as an attribute name is fundamentally unsafe.
- `props="..."` keeps internal names case-preserved and greppable.
- `name` is now an ordinary prop when declared in `props`, rather than being blocked by the template tag's `name` attribute.
- External call sites still use platform casing rules: `.on-toggle="$(fn)"` maps to `onToggle`.

I intentionally did not add a `props` object/bag. Authors get bare locals plus `el.prop`. That keeps the teaching surface smaller.

### State updates

There is only one mutation path: assign to the element property.

```js
el.count = (el.count || 0) + 1
```

Bare locals such as `count` are render-time values captured by ordinary JS closures. Live reads come from `el.count`.

I briefly added an `el.update('count', fn)` helper, but removed it because it introduced a second update path and magic string prop names. The current design is simpler and more refactorable.

### Mutable reference publishing

Directly assigning the same mutable object/array reference now republishes a render:

```js
el.items.push(nextItem)
el.items = el.items
```

Identical primitive assignments still stay quiet. `.prop` bindings still skip unchanged values so parent rerenders do not fan out through unchanged child props.

### Runtime vs precompiled mode

Runtime mode still uses `new Function`, so strict CSP needs precompiled mode.

Precompiled mode was added via `tools/precompile.mjs` and `registerPrecompiledTemplate(...)`. This is both a CSP path and a place to turn silent runtime mistakes into build-time failures later.

### Fetched templates and trust

Lazy resolution is now explicit via:

```js
configure({
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null
    return `/components/${name}.html`
  }
})
```

Auto-registration can be disabled or scoped:

```js
configure({
  autoRegister: false,
  autoRegisterRoot: document.getElementById('trusted-fragments')
})
```

The security stance is: escaped interpolation is safe; executing fetched JST/HTML is trusted-code execution.

## Runtime/Morphing Work

This branch made the morph engine substantially more capable, but this remains the area I most want reviewed.

Implemented/covered:

- keyed node identity with `jst-key`
- keyed reorder with interleaved whitespace
- uncontrolled input preservation across keyed reorder
- form property syncing for value/checked/selected/textarea/select/radio
- caret/selection preservation across unrelated rerenders
- uncontrolled mixed form state preservation
- nested keyed lists with inner form state
- table row keyed reorder
- SVG namespace/attribute morphing
- enter/leave/move transition class phases
- parent rerenders preserving child custom element DOM and state
- default/named/dynamic slots
- appended slot content surviving host rerenders

The adversarial matrix caught an additional real bug: uncontrolled `<textarea>` was reset on unrelated rerenders. I changed form morphing so `checked`/`selected` only sync when declared by the rendered template, and textareas only sync live value when their rendered default changes.

## Concerns Lab

Added:

- `concerns.html`: normal module version, served over HTTP.
- `concerns-standalone.html`: inline global/IIFE version that works directly from `file://`.

The page labels demos as:

- `Problem`
- `Design check`
- `Trust boundary`
- `Capability limit`
- `Recommended pattern`

This is intended to make review discussion more concrete. It includes actual JST snippets and live behavior.

## Files/Areas Worth Reviewing Closely

Please pay special attention to:

- `jst.js`
  - `morphChildren(...)`
  - `syncFormProperties(...)`
  - keyed matching and whitespace handling
  - child custom element skip behavior
  - slot capture/projection behavior
  - template registration / duplicate registration / resolver behavior
- `compiler.js`
  - `props` parsing and reserved names
  - `camelToKebab` mapping
- `lexer.js`
  - balanced expression parsing
  - regex/comment/string handling
  - comment inertness
- `interpreter.js`
  - binding compilation and fail-loud behavior
- `tools/precompile.mjs`
  - generated import paths and runtime coupling
- `run_tests.html`
  - adversarial DOM/morph test quality
- `runtime_tests.mjs`
  - parser/runtime behavior in mocked DOM
- `SECURITY.md`, `docs/production.md`, `docs/decision-guide.md`
  - whether the trust/CSP story is explicit enough
- `concerns.html`
  - whether the examples accurately communicate problems vs design checks

## Known Tradeoffs / Residual Risk

I am happy with the current direction, but I would still treat these as review targets:

- Morphing is still the highest-risk subsystem. The new matrix is much stronger, but DOM edge cases are broad.
- Runtime template compilation still needs `unsafe-eval`; precompiled mode is the production path for strict CSP.
- `props="..."` is a small JST-specific declaration. I think it is worth it for case preservation and accessor setup, but it is still an authoring choice to evaluate.
- Bare locals are render snapshots. This is ordinary JS closure behavior, but authors need to learn that live reads come from `el.prop`.
- `raw()`/`unsafeHTML()` is powerful and intentionally unsafe for untrusted content.
- The file-openable `concerns-standalone.html` is generated manually by an inline bundling script used during development, not by a committed production bundler.

## Validation Run

The final state passed:

```sh
npm test
```

That includes:

- Node runtime tests: 23/23
- Browser runtime tests: 41/41
- Example smoke tests: all example pages passed
- Framework parity verifier: 72/72 pages loaded cleanly
- Agentic feed smoke: passed
- VS Code tooling tests: 29/29

Additional manual Playwright smoke:

- Opened `concerns-standalone.html` via `file://`.
- Verified same-reference mutable assignment rerenders.
- Verified keyed input values survive repeated reversals.
- Verified no console warnings/errors.

## Commit List

```text
ae93434 Replace template params with props declarations
79c6cef Harden runtime morphing and dev behavior
32ecf08 Add directives and template resolution
322dff5 Add precompiled template registration
c0c70c2 Complete runtime directives and transitions
1651f77 Migrate examples and parity study to props API
b7de67c Document production path and update tooling
67741bc Add JST concerns demo page
ae21776 Add file-openable concerns demo
cc70ec4 Fix concerns demo source formatting
98e1cb9 Fix concerns demo remote fragment formatting
1a0b58f Clarify concerns demo categories
1d908a8 Fix prop publishing and keyed form preservation
d941f5b Use live property reads for derived state
77aef27 Add adversarial morph coverage
```

## Questions For Claude

1. Is `props="item onToggle"` the right minimal declaration model, or is there a cleaner way to preserve case and install accessors without adding more magic?
2. Does the morphing algorithm now have enough coverage for an experimental framework, or are there obvious missing DOM classes I should add before merging?
3. Are the form morphing rules correct: template-declared `value`/`checked`/`selected` control live state, while undeclared controls preserve user-owned state?
4. Are the trust-boundary docs explicit enough for fetched templates and `unsafeHTML()`?
5. Does `concerns.html` fairly separate real problems from design checks and capability limits?
6. Are there any changes here that undermine JST's core philosophy: plain HTML, plain JS, no store/proxies/build step by default, HATEOAS-friendly components?
