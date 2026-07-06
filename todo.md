# TODO

## Completed In The Hardening Roadmap

* [x] Case-preserved prop declarations with `props="item onToggle name"`.
* [x] Reserved names like `name` are valid props; helper names and JS keywords
      fail loudly.
* [x] Bare `$identifier` supports digits and full identifier-continue chars.
* [x] `$(...)` / `${...}` balancing understands strings, template strings,
      regex literals, and comments.
* [x] HTML comments are inert; `$foo` inside `<!-- ... -->` is not evaluated.
* [x] Malformed property bindings like `.items="$(a)$(b)"` fail at compile time.
* [x] `JST.configure({ dev: true })` renders visible template errors.
* [x] Property equality skips redundant child `.prop` updates and rerenders.
* [x] Property-aware morphing handles value, checked, selected, disabled,
      required, readOnly, multiple, focus, and caret stability.
* [x] `jst-model` covers local text, checkbox, checkbox-array, radio, select,
      and multi-select state.
* [x] `jst-key` preserves node identity across inserts and reorders.
* [x] Dynamic light-DOM children are observed and projected into slots.
* [x] `onDisconnect(fn)` provides teardown without a full hook system.
* [x] Uniform handlers: `on<event>` values are plain function bodies (native
      contract) everywhere; handler helpers (`changed`, `debounce`,
      `throttle`, `keys`) + registration-only modifiers (`.once .capture
      .passive .outside`); synthetic `onreveal` event (v0.6.0).
* [x] `jst-transition` adds CSS-owned enter, leave, and move classes.
* [x] Runtime configuration: `autoRegister`, `autoRegisterRoot`,
      `resolveTemplate`, and duplicate/source logging.
* [x] Lazy missing-template resolution for trusted server-streamed components.
* [x] `trustedHTML()` for explicit trusted HTML.
* [x] Precompile CLI and `registerPrecompiledTemplate()` for strict CSP paths.
* [x] Production docs, decision guide, HATEOAS notes, `SECURITY.md`, license,
      and package metadata.

## Editor Tooling

* [x] Tier 1: TextMate injection grammar for `$(...)`, `$ ...`, `${...}`, `$$`,
      `.prop`, `on<event>`, and modifiers inside `<script type="jst">`.
* [x] Tier 2: diagnostics run the real JST compiler over each block.
* [x] Tier 3: cross-file go-to-definition, hover, completion, and symbols.
* [ ] Manual VS Code extension-host check for grammar injection and LSP wiring.
* [ ] Tier 4: typed expressions via virtual TypeScript documents.
* [ ] tree-sitter grammar and Prettier plugin.

## Future Design Work

* [ ] Decide whether page-level request helpers are worth adding for HTMX-style
      polling/revealed/server-trigger ergonomics.
* [ ] Explore a small transition-group helper for FLIP move animations outside
      core, if real examples need it.
* [ ] Add richer typed prop metadata once the syntax is stable.
* [ ] Publish versioned CDN/package guidance after the first tagged release.
