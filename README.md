# &lt;JST/&gt;

**JavaScript Templates (JST)** - reactive web components in plain HTML, with
**JavaScript itself as the templating language**. **No build step.**

**JST builds on Web Components.** Its runtime/compiler - 11.5 KB gzipped
(37 KB minified), or 7 KB gzipped runtime-only with precompiled templates - turns a
`<script type="jst">` tag into a class and registers it with
`customElements.define()`, so every JST component is a genuine custom element:
inspectable in DevTools, scriptable with plain properties and
`addEventListener`, and usable inside any framework or none.

```html
<script type="module" src="jst.js"></script>

<script type="jst" name="hello-name" attributes="name">
  <p>Hello, <strong>$(name)</strong>!</p>
  <button onclick="el.name = 'world'">reset</button>
</script>

<hello-name name="JST"></hello-name>
```

## What hole it fills

- **HTMX** is strongest when server round-trips drive UI changes; JST targets fragments that also define reusable client-side component behavior.
- **Alpine** is strongest for behavior attached to existing markup; JST additionally gives streamed component definitions custom-element identity and an attributes-in, events-out boundary.
- **React/Vue** are powerful, but usually bring a build step, a runtime model, and a client-owned render pipeline.

JST targets HATEOAS-style apps where the backend and frontend should be able to
send the same thing: HTML that defines components, uses components, and can still
be interactive once it lands in the browser. A fetched fragment can include both
`<script type="jst">` definitions and the markup that uses them.

## Philosophy

1. **No build step by default** - components live in `<script type="jst">` in plain HTML.
2. **JavaScript is the templating language** - `$(expr)`, `$ if`, `$ forEach`; no second expression DSL.
3. **Hypertext as the API** - responses can be HTML carrying their own UI and next actions, not JSON that must be reshaped into client models.
4. **Attributes down, events up** - components are controlled renderers; state lives in the page, parent, or server.
5. **No store, no proxies, no hidden graph** - use plain JavaScript objects, properties, and events.
6. **Safe interpolation by default** - `$(expr)` escapes HTML; `url()` guards URL attributes; `trustedHTML()` is the explicit trusted-HTML escape.
7. **Fail loud** - invalid attribute declarations, malformed bindings, and render errors should be visible during development.

## Component API

For the full onboarding walkthrough, open [the docs](https://br3nt.github.io/jst/docs/) ([docs/index.html](docs/index.html) locally) - one page, ordered to teach, with annotated examples.

Inputs are declared in the case-preserving `attributes` attribute:

```html
<script type="jst" name="todo-item" attributes="item">
  <li jst-key="$(item.id)">
    <button onclick="event.stopPropagation(); el.emit('toggle', item)">Done</button>
    $(item.text)
  </li>
</script>

<todo-item id="first-todo"></todo-item>

<script>
  const row = document.getElementById('first-todo');
  row.item = { id: 1, text: 'Write docs' };
  row.addEventListener('toggle', event => console.log(event.detail));
</script>
```

- `attributes="item"` declares the values available by name in the template.
- Each declared attribute is also a JavaScript property on the element: `el.item`
  here, or `el.onToggle` when `onToggle` is declared.
- External HTML attributes use platform casing rules, so multi-word call sites
  use kebab-case: `on-toggle` maps to `onToggle`.
- Plain attributes carry JSON values (`count="1"`, `open="true"`,
  `items='[{"id":1}]'`), so a server can render data straight into the tag.
- Directly assigning a mutable object or array republishes it: mutate an array,
  then assign `el.items = el.items` to render. Identical primitive assignments
  stay quiet.
- When the next value depends on the current value inside an event handler, read
  the live element property: `el.count = (el.count || 0) + 1`.
- In ordinary HTML, use normal JavaScript property assignment and
  `addEventListener`. Inside a JST template, `.property="$(expr)"` passes rich
  JavaScript values without stringifying.
- Inside a JST template, `on<event>="…"` attaches a listener whose value is a
  plain **function body** - the native inline-handler contract (`event` in
  scope, `this` = the element), compiled in render scope and attached with
  `addEventListener`. Pace behaviour with the handler helpers - in scope
  in every handler body: `oninput="if (changed(event)) debounce(event, 300,
  () => search(this.value))"`, `onkeydown="keys(event, { Enter: () => go() })"`,
  `oncommand="commands(event, { '--save': save })"` (Invoker Commands routing).
  Dotted modifiers configure registration only: `.once`, `.capture`,
  `.passive`, `.outside`. The synthetic `onreveal` event fires when the element
  scrolls into view.
- `jst-model="title"` is local form shorthand: read from `title` and update
  `el.title` when the user changes it.
- `jst-key="$(id)"` preserves DOM identity during list inserts and reorders.
- `jst-transition="fade"` applies CSS-owned transition classes:
  `fade-enter-*`, `fade-leave-*`, and `fade-move`.
- `$(slot())` and `$(slot('name', 'fallback'))` project light-DOM children.
- `once(key, setup)` defers a rare DOM-local setup to a microtask after the
  render commits, runs it once per connection, and uses a returned function as
  disconnect cleanup.
- `onDisconnect(fn)` is the lower-level teardown escape hatch; prefer wrapping
  resource setup in `once()` so it is not re-registered on every render.

## Production Path

JST has two modes:

- **Runtime mode**: load `jst.js`; the browser compiles inline templates with
  `new Function`. This is ideal for prototypes, static pages, examples, and
  server-streamed trusted components.
- Runtime templates are executable JavaScript. Only auto-register or resolve
  templates from sources you trust; interpolated data remains escaped by default.
- **Global build**: load `jst.global.js` - the whole runtime as one classic
  (non-module) script that exposes `window.JST` and runs from `file://` with no
  server. For prototypes, copied/generated single files, and CDN drop-ins
  (`jst.global.min.js` is minified). See
  the [docs Install section](docs/index.html).
- **Precompiled mode**: run `tools/precompile.mjs` and load the generated module.
  This avoids runtime template compilation and is the path for strict CSP apps
  that cannot allow `unsafe-eval`. Pair it with the **runtime-only** build
  `jst.runtime.js` (or classic `jst.runtime.global.js`), which omits the compiler
  entirely - ~40% smaller. See
  the [docs Install section](docs/index.html).

```sh
node tools/precompile.mjs index.html --out dist/templates.js --runtime ../jst.js
```

See the [docs Security section](docs/index.html) and [SECURITY.md](SECURITY.md).

## Runtime Configuration

```js
import { configure } from './jst.js';

configure({
  dev: true,
  autoRegister: true,
  autoRegisterRoot: document.body,
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null;
    return `/components/${name}.html`;
  },
});
```

- `dev: true` renders visible error boxes instead of leaving stale/empty DOM, and
  logs the runtime version (`JST x.y.z`) once on load.
- `autoRegister: false` disables MutationObserver registration of arriving templates.
- `autoRegisterRoot` scopes automatic registration to a known container.
- `resolveTemplate(name)` lazily fetches missing component definitions - including
  components already present in the initial server-rendered HTML.

The loaded runtime version is available as `import { version }` and on
`window.JST.version`, so confirming an upgrade (vs. a stale cache) is a one-liner.

## Upgrading across breaking releases

Per-version migrations (with before → after tables) live in the
[CHANGELOG](CHANGELOG.md). Removed or renamed template syntax only errors when a
component renders in the browser, so run `node tools/lint.mjs` to find leftovers
(wire it into CI) and `node tools/codemod.mjs` for the mechanical rewrites
(`@event` → `on<event>`, `attrs` → `attributes`, expression handlers → function
bodies).

## Try it

Serve the repo root and open `index.html`:

```sh
python3 -m http.server 8000
# http://localhost:8000/
# http://localhost:8000/examples/kanban.html
# http://localhost:8000/framework_parity/index.html
```

## What's here

| Path | What |
|---|---|
| `jst.js` + `compiler.js` / `interpreter.js` / `lexer.js` / ... | the framework, zero runtime dependencies |
| `index.html` | landing page |
| `examples/` | kanban, todo, slots, counters |
| `framework_parity/` | 126 examples from HTMX, Alpine, Vue, React, fixi, Lit, Svelte, Solid, and Angular rebuilt in JST |
| `tools/` | `precompile.mjs` (CSP build), `codemod.mjs` + `lint.mjs` (migration) |
| `tooling/vscode-jst/` | VS Code syntax highlighting, diagnostics, and language server |
| `agentic_feed/` | a HATEOAS-feed prototype |
| `docs/index.html` | the docs: one onboarding page with annotated examples |
| `run_tests.html` / `runtime_tests.mjs` | test suites |

## Tests

```sh
node --test runtime_tests.mjs regression_tests.mjs tools_tests.mjs
npm run test:lint
node run_browser_tests.mjs
node run_example_smoke.mjs
node framework_parity/verify.mjs framework_parity/*/*.html
node agentic_feed/run_feed_smoke.mjs
npm --prefix tooling/vscode-jst test
```

Or just `npm test` to run the whole suite.
