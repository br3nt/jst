# Known gaps and roadmap

An honest list of what JST does and does not do yet, and the patterns to use in
the meantime. Status labels: shipped, planned.

## Transitions are CSS-driven and opt-in (shipped, v1)

Add `jst-transition="fade"` to a keyed (`jst-key`) child to get enter/leave
transitions with Vue-style class names (`fade-enter-from`/`-active`/`-to`,
`fade-leave-from`/`-active`/`-to`). The framework toggles the classes and the
timing; CSS does the actual animation. Enter plays on newly inserted keyed
nodes. On leave, the node is held (and excluded from reconciliation) until its
`transitionend` fires (or a 1.5s fallback), then removed. This is v1: it covers
keyed-list enter/leave; it is not a general FLIP/move-transition system, and the
leave timing depends on a real CSS transition firing `transitionend`.

## Keyed reconciliation is v1 (shipped)

`jst-key="$(id)"` gives keyed reconciliation: children are matched by key instead
of by position, so reordering and insertion preserve the matching node and its
focus, form state, scroll, and transitions. This is v1. It is correct and
covered by tests, but it is not a virtualization layer (see
[avoid-jst-when.md](./avoid-jst-when.md)) and may grow more options.

## Light DOM: no style or id encapsulation (by design)

JST components render into the light DOM, not a shadow root. Consequences:

- No style scoping. A component's CSS is page CSS. Two instances share the same
  rules.
- No id scoping. If a template hard-codes `id="title"`, every instance emits the
  same id, and duplicate ids collide across instances. `getElementById` and
  `label[for=...]` will resolve to the first match.

Patterns until/if encapsulation is offered (see
[writing-jst.md](./writing-jst.md#14-avoiding-id-collisions-in-the-light-dom) for
worked examples):

- **Prefer no internal id at all.** Use classes and query *within the component*
  (`el.querySelector('.thing')`), never `document.getElementById`. The component
  already scopes the search to itself, so a class is enough.
- **When an id is genuinely required** (a `label for`, or an aria relationship
  like `aria-controls`/`aria-describedby`), derive a unique *per-instance* id and
  wire `for`/`aria-*` to that derived id — never a hard-coded literal. Derive it
  from a prop that is unique per instance, or from a generated token stamped on
  the element once (a module counter, or a value set in `once()`).
- Scope styles by a component-specific class or a wrapper class rather than
  relying on the element name.

Shadow DOM would scope ids per root, but JST is light DOM by design (so
server-rendered HTML and client-rendered HTML are the same DOM and page CSS
applies uniformly). That makes id uniqueness the author's responsibility — the
id-collision sharp edge is real, so design around it.

## Attribute coercion is eager (shipped, know the trap)

Attribute strings that look like JSON are parsed: `count="0"` becomes the number
`0`, `flag="true"` becomes boolean `true`, and `version="1.0"` becomes the number
`1` (JSON parses `1.0` to `1`). If you need the literal string, pass it as a
property (`.version="$('1.0')"`) rather than an attribute, or accept the coercion.
Non-JSON-looking strings are left as strings.

## Precompile / strict-CSP mode (shipped, v1)

The browser compiler uses `new Function`, so strict CSP without `'unsafe-eval'`
blocks it. `tools/precompile.mjs` compiles templates ahead of time into a plain ES
module (no `new Function`):

```sh
node tools/precompile.mjs components.html --out dist/templates.js --runtime ../jst.js
```

Load that module alongside `jst.js` and the elements register under a strict
`script-src 'self'` policy. Unlike a string-replacement shim, precompiled
templates register through the **normal runtime** (`registerPrecompiledTemplate`),
so morphing, keyed reconciliation, focus/form-state preservation, and event
modifiers all still apply - precompiling only moves template compilation
out of the browser, it does not downgrade rendering. See
[production.md](./production.md).

## Tooling (partly shipped, partly planned)

- VS Code extension: syntax highlighting, diagnostics, and a language server
  exist under `tooling/`. It is not on the marketplace yet; install it manually.
- Typed expressions: planned. No type checking of template expressions today.
- Tree-sitter grammar: planned.
- Formatter: planned. No official formatter for JST templates yet.

## Direct file-open mode (planned)

The current runtime is an ES module build, and browsers block external module
imports from many direct `file://` pages. A classic/global build such as
`jst.global.js` is planned so copied examples, local prototypes, and
LLM-generated single HTML files can run directly from disk.

## Calling module code from a template needs a global (planned)

A template cannot `import`, and a server-streamed component root has no seam to
inject a function through before it renders. So when a template has to call into
a behaviour module, for example to mount a third-party widget in `once()`, the
reference is reached through a global such as `window.MyEditor.mount(el)`. For a
page that owns its components, the page-level script can inject via properties
instead (`el.controller = ...`); a streamed root cannot. Keep the bridge to a
single named object rather than scattering `window.*` across components. A
first-class injection or behaviour-registry mechanism is planned; until then,
treat the global as a known, contained gap.

## No uncontrolled-region directive for template-generated hosts (planned)

Hosting a third-party widget works by handing its mount node in as a slot;
projected slot nodes are detached during morphing and re-projected by reference,
so the morpher never recreates them (see
[controlled-components.md](./controlled-components.md#hosting-a-third-party-widget)).
That covers a static, single host. A host the template itself generates inside a
re-rendering region, a conditionally shown widget or one per array item, is not
slot-shaped, and there is no `jst-ignore`-style directive to mark a subtree the
morpher must leave alone. Composition covers most cases: make each item its own
component with its own slot. A genuine case that composition cannot shape is the
argument for an explicit uncontrolled-region directive; report it if you hit one.

## Summary

JST's core (custom elements, morphing, keyed reconciliation, CSS transitions,
bindings, lifecycle, fragment auto-registration, and a v1 precompile
path) is shipped and tested. The remaining gaps are mostly tooling polish
(formatter, typed expressions, tree-sitter, marketplace) and richer event triggers
(poll, intersection/revealed). None of them are hidden; pick JST knowing what is
and is not here yet.
