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

That is the whole install. No build-time compilation or bundling is required;
runtime mode compiles the templates in the browser.

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
the same origin as your pages. After a Git tag exists, you can also pin that tag
through a CDN; do not depend on a moving branch URL. See
[production.md](./production.md) for production specifics including CDN
pinning and CSP.

For the `v0.1.0` release, the version-pinned jsDelivr entry point is:

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/br3nt/jst@v0.1.0/jst.js"></script>
```

The imported modules resolve relative to that same tagged snapshot. Self-host
the release files if CDN availability is not an acceptable production
dependency.

## Asset pipelines and digested filenames

`jst.js` imports the rest of the framework with relative specifiers
(`./compiler.js`, `./interpreter.js`, and so on). An asset pipeline that
fingerprints filenames breaks that import graph. Rails Propshaft, or any bundler
that rewrites assets to digested names like `jst-9f2c1a.js`, leaves `jst.js`
still asking for `./compiler.js` while the served file is `compiler-3a7b04.js`,
so the import 404s.

Serve the JST module files as plain static files from a non-digested path, the
way the JST site itself ships them, and load the entry point as a module:

```html
<script type="module" src="/jst/jst.js"></script>
```

In a Rails app, put the files under `public/jst/` so Propshaft does not digest
them. Keeping every JST module together under one undigested path preserves the
relative imports intact.

## Serving locally

JST needs the files served over HTTP (ES modules do not load from `file://`).
Any static server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Serving and caching the no-build assets

Because JST serves source files directly with no build step, a stale cached copy
is the easiest way to confuse yourself: an edited `jst.js` or component file
served from a heuristically-cached copy (a server that sends only
`Last-Modified` and no `Cache-Control` lets the browser guess a freshness
window) looks unchanged, so an applied edit appears not to have applied — and a
cached v0.1 `jst.js` renders *identically* to v0.2, so "the page looks fine"
proves nothing. (See [`JST.version`](#which-version-is-live) for confirming which
runtime is actually live.)

Set an explicit cache policy for the JST module files and your component files:

- **Development:** serve them with revalidation — `Cache-Control: no-cache` (or
  `max-age=0, must-revalidate`) — so an edit shows on the next reload instead of
  from a guessed cache window.
- **Production:** fingerprint/version the assets (a tagged CDN path like
  `…/jst@v0.2.1/jst.js`, or your own digest in the URL) and serve them
  immutable, so a deploy is never served stale. If you cannot fingerprint, set an
  explicit short `max-age` rather than leaving caching to the server's heuristic.

This applies equally to the component `.html` files fetched by
[`resolveTemplate`](./production.md) — they are assets too.

## Which version is live

Because a stale cache renders identically, confirm the loaded runtime by reading
its version rather than diffing source:

```js
import { version } from '/jst/jst.js';
console.log(version);            // "0.2.1"
// or, without importing:
console.log(window.JST.version); // mirrors the export
```

`JST.version` is the runtime's own constant (a browser ES module can't read
`package.json`), so it reflects the file actually served. With
`configure({ dev: true })`, the runtime also logs `JST x.y.z` once to the console
on load. Assert `JST.version` in a smoke test or the console to be sure an
upgrade took effect.

## Upgrading across breaking releases

JST templates live in several places — standalone `.html` files, inline
`<script type="jst">` in server views (`.erb`, `.php`, …), and streamed
fragments. A removed/renamed construct (for example v0.2's `@event` → `onevent`,
or the removal of `raw()`/`unsafeHTML()`/`document.jst`) is a **render-time**
compile error: it only throws when that specific component renders in a browser,
so it is invisible to server-side and unit tests and easy to miss in one
surface. Two tools turn that into a build-time signal:

```sh
# Rewrite @event="$(fn)" -> onevent="$(fn)" (preserves modifiers and the value),
# only inside <script type="jst"> blocks — safe to point at views and fragments.
node tools/lint.mjs   "app/views/**/*.erb" "public/jst/**/*.html"   # find what's left
node tools/codemod.mjs "app/views/**/*.erb" "public/jst/**/*.html"  # apply @event migration
```

- **`tools/codemod.mjs`** (`npx jst-codemod`) — mechanical `@event` → `onevent`
  across every `<script type="jst">` block in the files you pass; `--dry-run`
  previews. It does **not** rewrite `raw()`/`unsafeHTML()` (those need a judgement
  call to `trustedHTML()`); lint flags them so you do it deliberately.
- **`tools/lint.mjs`** (`npx jst-lint`) — scans `<script type="jst">` blocks for
  removed syntax and exits non-zero with `file:line:col`. Pass `--runtime jst.js`
  to also catch a stale vendored runtime (leftover `jst-ssr`/`document.jst`). Wire
  it into CI so a leftover binding fails the build instead of a page.

Because both scope the template rules to `<script type="jst">` blocks, they
ignore `@media`, decorators, email addresses, and other-framework `@click`
(Alpine/Vue) in the surrounding markup.

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
node --test runtime_tests.mjs regression_tests.mjs tools_tests.mjs
npm run test:lint
node run_browser_tests.mjs
node run_example_smoke.mjs
(cd framework_parity && node verify.mjs $(find htmx alpine vue react -name '*.html'))
```

- `node --test runtime_tests.mjs regression_tests.mjs tools_tests.mjs` runs the
  framework unit/regression tests and the codemod/lint tool tests in Node.
- `npm run test:lint` dogfoods `tools/lint.mjs` over JST's own template surfaces
  and runtime, so a removed-syntax regression fails the build.
- `node run_browser_tests.mjs` runs the framework tests in headless Chrome.
- `node run_example_smoke.mjs` drives the example pages in headless Chrome.
- The `framework_parity` command verifies readiness, console/JST errors, and a
  per-page interaction or rendered-output assertion. It does not turn the
  exact/partial editorial classifications into benchmark results.
