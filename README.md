# JST

**Reactive web components in plain HTML. No build step.**

JST turns a `<script type="jst">` tag into a real custom element. You write
components in ordinary HTML with JavaScript as the templating language — no
compiler, no bundler, no JSX, no virtual DOM, no signals.

```html
<script type="module" src="jst.js"></script>

<script type="jst" name="hello-name" name>
  <p>Hello, <strong>$(name)</strong>!</p>
  <button @click="$(() => el.name = 'world')">reset</button>
</script>

<hello-name name="JST"></hello-name>
```

## What hole it fills

- **HTMX** lets the server send HTML, but has no client interactivity without a round-trip.
- **Alpine** adds client interactivity, but the server can't stream components.
- **React/Vue** are powerful, but need a build step, a virtual DOM, and a runtime.

JST: components in plain HTML that the **server can stream down** (a fetched
fragment can define *and* use a component — it auto-registers via a
`MutationObserver`), with **full client interactivity**, **no build**, and **no
virtual DOM or signals**. It rides the platform — custom elements, properties,
bubbling events, and DOM morphing.

## Philosophy

1. **No build step** — the browser is the toolchain.
2. **JavaScript is the templating language** — `$(expr)`, `$ if`, `$ forEach`.
3. **Ride the platform** — properties carry data in, `CustomEvent`s carry actions out, the DOM is morphed in place.
4. **Props down, events up** — components are dumb renderers; state lives in the page/parent.
5. **The server can ship components** — HATEOAS, with a component model.
6. **Safe by default** — interpolation is HTML-escaped unless you opt out with `raw()`.

## Try it

Serve the repo root and open `index.html`:

```sh
python3 -m http.server 8000
# http://localhost:8000/            — landing page (live demo)
# http://localhost:8000/examples/kanban.html
# http://localhost:8000/framework_parity/index.html   — the parity study
```

## What's here

| Path | What |
|---|---|
| `jst.js` + `compiler.js` / `interpreter.js` / `lexer.js` / … | the framework (~600 lines, zero dependencies) |
| `index.html` | landing page |
| `examples/` | kanban, todo, slots, counters |
| `framework_parity/` | 70 HTMX/Alpine/Vue/React examples rebuilt in JST + a browsable hub and gap report |
| `tooling/vscode-jst/` | VS Code syntax highlighting, diagnostics, and a language server |
| `agentic_feed/` | a HATEOAS-feed prototype (needs Node to run its SSE server) |
| `run_tests.html` / `runtime_tests.mjs` | the test suites |

## Tests

```sh
node --test runtime_tests.mjs          # framework unit tests (Node)
node run_browser_tests.mjs             # framework tests in headless Chrome
node run_example_smoke.mjs             # example pages, driven in headless Chrome
```
