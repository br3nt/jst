# JST tooling backlog

## Tier 4 — type the embedded expressions by reusing TypeScript (not a hand-rolled checker)

JST adds only syntax; the contents are real HTML + real JS. So deep validation
should **delegate to existing tools**, never reimplement them. The lever JST
hands us: `interpretTemplateTokens` already emits a valid JS function body.

Approach (the Volar / Svelte "virtual document" technique):
- For each `<script type="jst">`, generate a virtual `.ts` document:
  `function render(${params}: ...) { ${compiledFunctionBody} }`
- Hand it to the TypeScript language service.
- Map TS diagnostics / completions / hovers back to template positions via a
  source map between the generated body and the original `$(...)` spans.

Result: real type-checking, autocomplete on `card.` etc., all from the existing
TS service. Effort: substantial (the position mapping is the work). Do this only
once the syntax is stable.

Cheaper interim: param types via JSDoc on the template, surfaced in hover.

## tree-sitter grammar

A `tree-sitter-jst` grammar gives highlighting in Neovim, Zed, Helix, and
GitHub's code view from one definition (vs the VS-Code-only TextMate grammar).
Could also back a faster/structural diagnostics path. Scope: injection grammar
for the `$(...)`, `$ …`, `${...}`, `$$`, `.prop`/`@event` constructs inside
HTML `script` elements.

## Prettier plugin

Format JST templates: indent the HTML, leave `$(...)`/`$ …` islands intact
(optionally format the JS inside via Prettier's own JS printer). A Prettier
plugin with an `embed` for the `<script type="jst">` regions.

## Smaller refinements

- **Own the tag/attribute parsing inside JST blocks** instead of deferring to
  VS Code's HTML grammar. HTML's tag parser can get mildly confused by `@`/`.`
  attribute names (non-standard). Giving the injection grammar explicit
  start-tag handling that knows about `.prop`/`@event` would remove the last
  highlighting glitches around bindings — at the cost of reimplementing basic
  tag/attribute/string highlighting (the Vue/Svelte approach).
- Highlight the param attributes on the `<script type="jst" name=… foo bar>`
  open tag itself (currently the open-tag attribute blob isn't sub-scoped).
- Diagnostics: warn on a `.prop`/attribute usage at a call site that isn't a
  declared param of the target component (needs the cross-file index, which the
  Tier 3 server already builds — wire it into `computeDiagnostics`).
- Completion: suggest `slot()`, `raw()`, `el.emit()` inside `$(...)`.
- Go-to-definition from a `.prop` binding to the param on the component.
- Workspace indexing: index `.html` files on disk, not just open documents, so
  navigation works before a file is opened.
