# vscode-jst

Editor tooling for JST templates (`<script type="jst">`). Lives outside the
core framework so JST itself stays dependency-free; all dependencies here are
the extension's own.

## What it provides

**Tier 1 — syntax highlighting** (two grammars in `syntaxes/`)
TextMate grammars **injected into HTML**. `jst.injection` marks the
`<script type="jst">` block with a distinctive scope; `jst.islands` injects the
JST constructs into anything carrying that scope — so they highlight inside HTML
tags and attribute-value strings too (`onclick="$(…)"`), not only in text. The
embedded JavaScript is delegated to the editor's own `source.js` grammar:

- `$(expr)` and `$identifier` — interpolation
- `$ …` line directives — embedded code, including control flow that wraps HTML
- `${ ... }` — JavaScript-only embedded code blocks
- `$$` — escaped literal `$`
- `.prop=` / `on<event>=` — binding attributes (e.g. `onclick.stop`)

**Tier 2 — diagnostics** (`src/diagnostics.mjs`)
Runs the **real JST compiler** (`../../compiler.js`) over each template, so
what the editor flags is exactly what the runtime rejects — there is no second
"is this valid JST?" implementation to drift. Embedded-JavaScript syntax errors
are caught by handing the compiled function body to V8 itself (`new Function`),
i.e. the existing JS parser does the validating. Also lints JST-specific rules:
missing/hyphenless component names, duplicate names.

**Tier 3 — navigation** (`src/providers.mjs`, served by `src/server.mjs`)
A language server providing, across files:

- **Go-to-definition** — from a `<my-card>` usage to its `<script type="jst"
  name="my-card">` definition (even in another file).
- **Hover** — a component's declared attributes.
- **Completion** — known component tags after `<`; a component's attributes and
  `.prop` binding forms inside its open tag.
- **Document symbols** — every component defined in a file.

## Architecture

All logic is in pure, dependency-light ESM modules tested headlessly with
`node --test`:

| Module | Responsibility |
|---|---|
| `src/jst-blocks.mjs` | find `<script type="jst">` blocks + map positions |
| `src/diagnostics.mjs` | Tier 2 diagnostics via the real engine |
| `src/model.mjs` | cross-file component index + tag-context analysis |
| `src/providers.mjs` | Tier 3 definition / hover / completion / symbols |
| `src/server.mjs` | LSP transport glue (thin) |
| `src/extension.js` | VS Code client glue (thin) |

## Tests

```
npm install
npm test
```

32 tests: grammar tokenization (through the real `vscode-textmate` engine),
diagnostics (through the real JST compiler), and providers (including against
the actual `examples/kanban.html`).

## Verification status — read this

- **Tiers 2 and 3 logic**: fully verified headlessly. These reuse the real JST
  engine and are tested against real example files.
- **Tier 1 grammar patterns**: verified by tokenizing through the real
  TextMate engine and asserting scopes.
- **Not automated**: whether the grammar *injects* correctly inside
  `<script type="jst">` in a live editor, and the LSP client/server transport
  (`extension.js` / `server.mjs` wiring). These need VS Code's own HTML grammar
  and extension host, which can't run in this headless harness. To check them,
  press F5 in VS Code with this folder open (Extension Development Host), then
  open any file in `examples/`.

## Known rough edges

- **Syntactic, not semantic, highlighting inside `$(…)`.** The embedded JS gets
  TextMate scopes (keywords, strings, numbers, etc.) — the same syntactic layer
  a plain `<script>` gets. It does *not* get the richer *semantic* coloring the
  TypeScript language service adds in real `.js`/`.ts` (e.g. distinguishing
  locals, props, member properties). That gap is exactly what Tier 4 (virtual
  TS documents, see `TODO.md`) closes. So an expression may look slightly less
  colorful than the same code in a standalone script — by design, for now.
- **`.prop` / `on<event>` attribute names** can be non-standard HTML (the
  leading-`.` property bindings and dotted modifier tails like `onclick.stop`),
  so VS Code's HTML tag parser can still get mildly confused around them in some
  tags. The islands
  grammar now colors the binding names and their `$(…)` values, which masks most
  of it; if a tag still mis-highlights after the binding, the fix is to give the
  injection grammar its own tag/attribute handling instead of deferring to HTML
  (noted in `TODO.md`).

## Backlog

See `TODO.md` — tree-sitter grammar (Neovim/Zed/GitHub), Prettier plugin, and
the Tier-4 "type the expressions by reusing TypeScript" approach.
