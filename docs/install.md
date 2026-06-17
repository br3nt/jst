# Install

JST has no build step and no dependencies. You include one ES module.

## Script-module include

Add `jst.js` as a module script. It initializes itself on load: it registers
every `<script type="jst">` already in the document and starts a
`MutationObserver` so templates that arrive later (fetched fragments) register
too.

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="/jst.js"></script>
  </head>
  <body>
    <script type="jst" name="hello-name" props="name">
      <p>Hello, <strong>$(name)</strong>!</p>
    </script>

    <hello-name name="JST"></hello-name>
  </body>
</html>
```

That is the whole install. There is nothing to compile and nothing to bundle.

## File layout

`jst.js` is the entry point. It imports the rest of the framework as plain ES
modules:

| File | Role |
|---|---|
| `jst.js` | runtime: custom-element registration, morphing, bindings, lifecycle |
| `compiler.js` | turns a `<script type="jst">` into a render function |
| `interpreter.js` / `lexer.js` / `parser.js` / `tokens.js` | the template language |
| `utils.js` / `input_reader.js` | helpers |

Because they are ES modules, the browser fetches them on demand. Serve them from
the same origin as your pages, or pin a versioned copy on a CDN. See
[production.md](./production.md) for production specifics including CDN
pinning and CSP.

## Serving locally

JST needs the files served over HTTP (ES modules do not load from `file://`).
Any static server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Direct `file://` mode

The current runtime is an ES module build. Chrome and several other browsers
block external module imports from `file://`, so a plain page like this will not
load directly from disk:

```html
<script type="module" src="./jst.js"></script>
```

There are three practical paths:

- Use a tiny local static server during development (`python3 -m http.server`).
- Use precompiled production mode for strict CSP and release builds.
- Add a future classic/global build such as `jst.global.js` for truly
  file-openable demos. That build would wrap internals in an IIFE and expose only
  the deliberate `window.JST` API. It is not the primary runtime in this branch
  yet.

## Running the tests

From the repo root:

```sh
node --test runtime_tests.mjs regression_tests.mjs
node run_browser_tests.mjs
node run_example_smoke.mjs
(cd framework_parity && node verify.mjs $(find htmx alpine vue react -name '*.html'))
```

- `node --test runtime_tests.mjs regression_tests.mjs` runs the framework unit
  and regression tests in Node.
- `node run_browser_tests.mjs` runs the framework tests in headless Chrome.
- `node run_example_smoke.mjs` drives the example pages in headless Chrome.
- The `framework_parity` command verifies the HTMX/Alpine/Vue/React parity
  examples rebuilt in JST.
