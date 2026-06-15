# TODO

## Done (the properties/events/slots revision)

* [x] Escape `$(...)` interpolations by default; `$(raw(expr))` opts out.
* [x] Params become real properties: `el.items = [...]` re-renders. Attributes
      stay for primitives (JSON-parsed, no eval). Kebab-case attrs map to
      camelCase params (`on-toggle` -> `onToggle`) — the identifier-scanning
      casing guesser is gone.
* [x] `.prop="$(expr)"` template bindings pass rich data to children
      (side-table + post-morph assignment, no serialization).
* [x] `@event="$(fn)"` template bindings attach listeners; `el.emit(name, detail)`
      dispatches bubbling CustomEvents. `document.jst.call` and window-global
      callbacks are gone.
* [x] Light-DOM slots: `$(slot())` and `$(slot('name', 'fallback'))` project the
      component's original children; projected nodes survive re-renders.
* [x] MutationObserver registers `<script type="jst">` templates that arrive
      after load (the htmx story: server can ship component definitions in a
      fragment). `<jst-app>` wrapper no longer needed.
* [x] Lexer hardening: string-aware `$(...)`/`${...}` balancing, string-aware
      `$ line` termination, ASI-safe generated code.
* [x] Removed: proxy reactivity layer, `:attr` eval channel, write-back proxies,
      per-tag instance registry.

## Editor tooling (tooling/vscode-jst/)

* [x] Tier 1 — TextMate injection grammar: highlights `$(…)`, `$ …`, `${…}`,
      `$$`, `.prop`/`@event` inside `<script type="jst">`, delegating embedded
      JS to `source.js`. Tested via real vscode-textmate tokenization.
* [x] Tier 2 — diagnostics that run the REAL JST compiler over each block, so
      editor errors == runtime errors. Embedded-JS syntax errors caught via V8
      (`new Function`). Lints missing/hyphenless/duplicate names.
* [x] Tier 3 — language server: cross-file go-to-definition, hover (params),
      completion (component tags + params/.prop), document symbols. Pure
      providers tested headlessly against the real kanban example.
* [ ] Manual check in VS Code (F5 Extension Development Host): grammar
      injection inside live HTML + LSP client/server transport. (Logic is
      tested; only the editor wiring is unverified headlessly.)
* [ ] Tier 4 — type the `$(…)` expressions by generating a virtual TS document
      from the compiled function body and reusing the TypeScript service
      (Volar-style). See tooling/vscode-jst/TODO.md.
* [ ] tree-sitter grammar (Neovim/Zed/GitHub) and a Prettier plugin. Backlog in
      tooling/vscode-jst/TODO.md.

## What to work on next

* [ ] Document the conventions in a README (data in: attributes/properties,
      data out: events; escaping; slots; the htmx pairing).
* [ ] Demo page that actually fetches an HTML fragment containing a new
      `<script type="jst">` + markup that uses it (proves the htmx story
      end-to-end over the network).
* [ ] Slot content is captured once on first connect; re-assigning children
      later does nothing. Decide if that needs a `refreshSlots()` or observer.
* [ ] Keyed list morphing (`jst-key` attr?) so reordering long lists doesn't
      churn DOM nodes pairwise.
* [ ] Consider `checked`/`value`/`selected` property-aware morphing so form
      state and synced attributes can't drift (workaround today: bind them
      explicitly with `.checked="$(...)"`).
