# Install

JST has no build step and no runtime dependencies. You pick a build by two
questions: **do you serve over HTTP or open from `file://`?** and **does the
browser compile your templates, or do you precompile them?**

## Delivery modes

The compiler turns `<script type="jst">` templates into render functions. You
either ship it (the browser compiles inline templates) or precompile templates
ahead of time and ship a smaller **runtime-only** build that drops the compiler
(~40% smaller, and no `new Function`).

| Build | Include | `file://`? | Compiler in browser | Use when |
|---|---|:--:|:--:|---|
| **`jst.js`** — ES module, full *(default)* | `<script type="module" src="jst.js">` | No | yes | Normal app served over HTTP, with inline `<script type="jst">` or `resolveTemplate` |
| **`jst.global.js`** — classic, full | `<script src="jst.global.js">` | **Yes** | yes | Prototypes, copied/generated single files, opening off disk, a one-line CDN drop-in |
| **`jst.runtime.js`** — ES module, no compiler | `<script type="module" src="jst.runtime.js">` + a precompiled module | No | no | Precompiled app over HTTP; smallest runtime; strict CSP |
| **`jst.runtime.global.js`** — classic, no compiler | `<script src="jst.runtime.global.js">` + a precompiled `--global` file | **Yes** | no | Precompiled app with no build/server, or a CDN drop-in |

All four register the same components and render identically — they differ only
in how the runtime reaches the browser and whether it can compile templates
on the fly. The two **global** builds are the module runtime concatenated into
one classic (non-module) script that exposes `window.JST` and self-initializes;
with no `import` statements they run from `file://`. The two **runtime-only**
builds omit the compile pipeline, so they render only *precompiled* templates —
calling in-browser compilation throws a clear error telling you to precompile.

**Quick chooser:**

- Serving over HTTP, authoring templates inline → **`jst.js`**.
- Want to open the page off disk / drop one `<script>` in / no build → **`jst.global.js`**.
- Precompiling for production (smallest, strict-CSP) → **`jst.runtime.js`** + a precompiled module (see [production.md](./production.md)).
- Precompiling *and* want no build/server or a CDN drop-in → **`jst.runtime.global.js`** + a precompiled `--global` file.

See [Global build](#global-build-no-modules-or-server),
[Precompiled + runtime-only](#precompiled-and-the-runtime-only-builds), and
[The two build tools](#the-two-build-tools) below.

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
    <script type="jst" name="hello-name" attributes="name">
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
| `input_reader.js` | helper |

Because they are ES modules, the browser fetches them on demand. Serve them from
the same origin as your pages.

> **Vendor the whole set, not just `jst.js`.** These files are one import graph
> (`jst.js` → `compiler.js` → `parser/interpreter/lexer/tokens/input_reader`).
> Vendoring `jst.js` alone gives a 404 on its first `import` and **all rendering
> silently breaks**. Either serve every file in the table above from the same
> directory, **or vendor the single-file build `jst.global.js`** (everything
> concatenated — one file, nothing to keep in sync). The runtime-only equivalents
> are `jst.runtime.js` (its own graph) and `jst.runtime.global.js` (single file).

After a Git tag exists, you can also pin that tag through a CDN; do not depend on
a moving branch URL. See [production.md](./production.md) for production specifics
including CDN pinning and CSP.

Pin a released tag. For the current release the version-pinned jsDelivr entry
point is:

```html
<!-- ES-module runtime (relative imports resolve against the same tag) -->
<script type="module" src="https://cdn.jsdelivr.net/gh/br3nt/jst@v0.4.2/jst.js"></script>

<!-- or the single-file global build (no modules) -->
<script src="https://cdn.jsdelivr.net/gh/br3nt/jst@v0.4.2/jst.global.js"></script>
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
    <script type="jst" name="hello-name" attributes="name">
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

## Precompiled, and the runtime-only builds

The full builds compile your `<script type="jst">` templates in the browser
(with `new Function`). If you compile them ahead of time instead — at build, or
with a dev server that recompiles on change and serves the result — the browser
never compiles, and you can ship a **runtime-only** build that omits the whole
compile pipeline (`compiler` + `parser` + `lexer` + `interpreter` + `tokens` +
`input_reader`): about **40% smaller**, and inherently strict-CSP because there
is no `new Function` at all.

`tools/precompile.mjs` turns templates into a JS file of render functions that
register through the normal runtime. There are two output shapes, matched to the
two runtime-only builds:

```sh
# ES module output → load with jst.runtime.js
node tools/precompile.mjs components.html --out dist/templates.js --runtime ./jst.runtime.js

# classic output → load with jst.runtime.global.js (no modules, file:// ok)
node tools/precompile.mjs components.html --out dist/templates.global.js --global
```

```html
<!-- ES-module, precompiled: smallest runtime over HTTP -->
<script type="module" src="/jst.runtime.js"></script>
<script type="module" src="/dist/templates.js"></script>

<!-- classic, precompiled: no build, no server -->
<script src="/jst.runtime.global.js"></script>
<script src="/dist/templates.global.js"></script>
```

The runtime-only builds still register, morph, do keyed reconciliation,
transitions, lifecycle — everything except *compiling a raw template*. If an
inline `<script type="jst">` reaches one, it throws a clear error pointing you at
precompilation. Use a **full** build if you need in-browser compilation
(inline templates or `resolveTemplate`). More on the precompiled path and CSP in
[production.md](./production.md).

## The two build tools

JST ships two tools under `tools/`. They are easy to confuse — one operates on
*your templates*, the other on *the framework itself*:

| Tool | Operates on | Produces | You run it |
|---|---|---|---|
| **`precompile.mjs`** (`jst-precompile`) | **your** `<script type="jst">` templates | a JS file of render functions (ESM or `--global`) | when you precompile for production/CSP/runtime-only |
| **`build_global.mjs`** (`npm run build`) | the **framework's** ES modules | the `jst.global.js` / `jst.runtime*.js` build artifacts | only if you hack on JST's runtime; `--check` guards drift in CI |

If you are *using* JST, you only ever touch `precompile.mjs` (and only if you
precompile). `build_global.mjs` is how this repo generates the shipped
global/runtime builds from `jst.js` and friends; consumers get those prebuilt on
npm and as release assets.

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
  `…/jst@v0.4.2/jst.js`, or your own digest in the URL) and serve them
  immutable, so a deploy is never served stale. If you cannot fingerprint, set an
  explicit short `max-age` rather than leaving caching to the server's heuristic.

This applies equally to the component `.html` files fetched by
[`resolveTemplate`](./production.md) — they are assets too.

## Which version is live

Because a stale cache renders identically, confirm the loaded runtime by reading
its version rather than diffing source:

```js
import { version } from '/jst/jst.js';
console.log(version);            // "0.4.2"
// or, without importing:
console.log(window.JST.version); // mirrors the export
```

`JST.version` is the runtime's own constant (a browser ES module can't read
`package.json`), so it reflects the file actually served. With
`configure({ dev: true })`, the runtime also logs `JST x.y.z` once to the console
on load. Assert `JST.version` in a smoke test or the console to be sure an
upgrade took effect.

## Upgrading across breaking releases

**What changed, and the before → after for each release, lives in the
[CHANGELOG](../CHANGELOG.md)** — that's the single source. In 0.x there have been
two breaking releases: **0.2.0** (`@event` → `on<event>`,
`raw()`/`unsafeHTML()` → `trustedHTML()`, `document.jst` removed) and **0.3.0**
(`props=` → `attributes=`).

This section is just the *how*. JST templates live in several places — standalone
`.html`, inline `<script type="jst">` in server views (`.erb`, `.php`, …), and
streamed fragments — and a removed/renamed construct is a **render-time** error:
it only throws when that component renders in a browser, so it's invisible to
server-side and unit tests and easy to miss in one surface. Two tools turn that
into a build-time signal:

```sh
node tools/lint.mjs   "app/views/**/*.erb" "public/jst/**/*.html"   # find leftovers (file:line:col)
node tools/codemod.mjs "app/views/**/*.erb" "public/jst/**/*.html"  # apply the mechanical @event rewrite
```

- **`tools/lint.mjs`** (`npx jst-lint`) — scans `<script type="jst">` blocks for
  removed/renamed syntax (`@event`, `raw()`/`unsafeHTML()`, `document.jst`, and
  the removed `props=` keyword) and exits non-zero with `file:line:col`. Wire it
  into CI so a leftover fails the build instead of a page. `--runtime jst.js`
  also catches a stale vendored runtime (`jst-ssr`/`document.jst`).
- **`tools/codemod.mjs`** (`npx jst-codemod`) — mechanically rewrites `@event` →
  `on<event>` (preserves modifiers; `--dry-run` previews). The other migrations
  (`raw()`/`unsafeHTML()` → `trustedHTML()`, `props=` → `attributes=`) are a
  rename/judgement call you apply deliberately — lint points at each one, and the
  CHANGELOG shows the before → after.

Both scope to `<script type="jst">` blocks, so surrounding `@media`, decorators,
and other-framework `@click` (Alpine/Vue) are untouched.

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
