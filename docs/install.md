# Install

JST has no build step and no runtime dependencies. There are three ways to load
it; pick by how you serve your page.

## Delivery modes

| Mode | Include | Needs a server? | Use when |
|---|---|---|---|
| **ES module** (default) | `<script type="module" src="jst.js">` | Yes (ES modules don't load from `file://`) | Normal apps served over HTTP; the standard path |
| **Global build** | `<script src="jst.global.js">` | No — runs from `file://` too | Quick prototypes, copied/LLM-generated single files, opening a page straight off disk, a one-line CDN drop-in |
| **Precompiled** | `<script type="module" src="dist/templates.js">` + `jst.js` | Yes | Strict CSP (no `unsafe-eval`); compiles templates ahead of time |

All three register the same components and render identically — they differ only
in how the runtime reaches the browser. The global build is the same code as the
ES-module runtime, concatenated into one classic (non-module) script that exposes
`window.JST` and self-initializes; because it has no `import` statements, the
browser will run it from `file://`. See [Global build](#global-build-no-modules-or-server)
and, for precompiled, [production.md](./production.md).

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

Pin a released tag. For the current release the version-pinned jsDelivr entry
point is:

```html
<!-- ES-module runtime (relative imports resolve against the same tag) -->
<script type="module" src="https://cdn.jsdelivr.net/gh/br3nt/jst@v0.2.2/jst.js"></script>

<!-- or the single-file global build (no modules) -->
<script src="https://cdn.jsdelivr.net/gh/br3nt/jst@v0.2.2/jst.global.js"></script>
<!-- minified: jst.global.min.js -->
```

The imported modules resolve relative to that same tagged snapshot. Self-host
the release files if CDN availability is not an acceptable production
dependency.

## Global build (no modules or server)

The ES-module runtime needs an HTTP server because browsers block module imports
from `file://`. The **global build** sidesteps that: `jst.global.js` is the whole
runtime concatenated into one classic script with no `import` statements, so it
runs straight off disk.

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="jst.global.js"></script>
  </head>
  <body>
    <script type="jst" name="hello-name" props="name">
      <p>Hello, <strong>$(name)</strong>!</p>
    </script>
    <hello-name name="JST"></hello-name>
  </body>
</html>
```

Double-click that file (or any single HTML file that inlines the build) and it
works — no server, no build. It exposes the same `window.JST` API and the same
ES-named exports' behavior; `jst.global.min.js` is the minified form for
production drop-ins. Both ship as release assets and on npm, and are
CDN-pinnable at a tag (above).

The build is generated from the module sources by `npm run build`
(`tools/build_global.mjs`); a `--check` mode in CI keeps it in sync, so the
committed `jst.global.js` never drifts from `jst.js`.

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
  `…/jst@v0.2.2/jst.js`, or your own digest in the URL) and serve them
  immutable, so a deploy is never served stale. If you cannot fingerprint, set an
  explicit short `max-age` rather than leaving caching to the server's heuristic.

This applies equally to the component `.html` files fetched by
[`resolveTemplate`](./production.md) — they are assets too.

## Which version is live

Because a stale cache renders identically, confirm the loaded runtime by reading
its version rather than diffing source:

```js
import { version } from '/jst/jst.js';
console.log(version);            // "0.2.2"
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

The ES-module runtime (`<script type="module" src="./jst.js">`) will **not** load
from disk: Chrome and several other browsers block module imports over `file://`.
Two paths work without a server:

- **Global build** — load `jst.global.js` (a classic, non-module script with no
  imports). Double-click the HTML file and it runs. See
  [Global build](#global-build-no-modules-or-server) above. This is the path for
  copied examples, local prototypes, and single generated HTML files.
- **Local static server** — for the module runtime during development, a tiny
  server is enough (`python3 -m http.server`).

For strict-CSP release builds, use [precompiled mode](./production.md) (it removes
runtime `new Function` compilation); that path still serves over HTTP.

## Running the tests

From the repo root:

```sh
node --test runtime_tests.mjs regression_tests.mjs tools_tests.mjs
npm run test:lint
npm run build:check
node run_browser_tests.mjs
node run_example_smoke.mjs
(cd framework_parity && node verify.mjs $(find htmx alpine vue react -name '*.html'))
```

- `node --test runtime_tests.mjs regression_tests.mjs tools_tests.mjs` runs the
  framework unit/regression tests and the codemod/lint/global-build tool tests in
  Node.
- `npm run test:lint` dogfoods `tools/lint.mjs` over JST's own template surfaces
  and runtime, so a removed-syntax regression fails the build.
- `npm run build:check` verifies `jst.global.js` and the inlined standalone are in
  sync with the module sources (run `npm run build` to regenerate).
- `node run_browser_tests.mjs` runs the framework tests in headless Chrome.
- `node run_example_smoke.mjs` drives the example pages in headless Chrome.
- The `framework_parity` command verifies readiness, console/JST errors, and a
  per-page interaction or rendered-output assertion. It does not turn the
  exact/partial editorial classifications into benchmark results.
