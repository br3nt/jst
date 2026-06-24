# Production Notes

## Runtime vs Precompiled

Runtime mode compiles templates in the browser:

```html
<script type="module" src="/jst.js"></script>
<script type="jst" name="app-card" props="title">
  <article>$(title)</article>
</script>
```

Precompiled mode moves that compilation out of the browser:

```sh
node tools/precompile.mjs components.html --out dist/templates.js --runtime ./jst.runtime.js
```

```html
<script type="module" src="/jst.runtime.js"></script>
<script type="module" src="/dist/templates.js"></script>
```

When you precompile, pair it with the **runtime-only** build `jst.runtime.js`
rather than the full `jst.js`: the compiler is dead weight once nothing compiles
in the browser, and dropping it removes ~40% of the runtime (and the last
`new Function`). The full `jst.js` also works as the runtime for a precompiled
bundle — it just ships the unused compiler. Use the runtime-only build for the
leanest, strictest-CSP deployment.

This is the **prod and dev** shape for a server that compiles templates and
sends the compiled version down:

- **Production:** precompile at build time, serve `dist/templates.js` (fingerprinted).
- **Development:** a watch step (or a dev server) reruns `precompile.mjs` on
  change and serves the result; the browser never compiles. The page loads the
  same `jst.runtime.js`.

Use full **runtime mode** (`jst.js`) for development with inline templates and
trusted streamed fragments, where in-browser compilation is convenient. Use
**precompiled + `jst.runtime.js`** for strict CSP and release builds.

For loading without a server (or straight from `file://`), the classic builds
are a fourth shape: `jst.global.js` (full, compiles in the browser) for
prototypes and single files, and `jst.runtime.global.js` (no compiler) paired
with `precompile.mjs --global` output for a precompiled drop-in with no build
step. See
[install.md](./install.md#precompiled-and-the-runtime-only-builds).

## Choosing between the two no-inline paths

Two features let you avoid inlining every definition on every page, and under a
strict CSP they are mutually exclusive.

- Precompiled bundle - `tools/precompile.mjs` compiles ahead of time into a
  plain ES module with no `new Function`, so it runs under strict
  `script-src 'self'`. The cost is a build step.
- `resolveTemplate` - the runtime fetches each definition and compiles it in the
  browser with `new Function`, so it needs `script-src 'self' 'unsafe-eval'`.
  The benefit is no build step and true on-demand loading.

Under a strict `script-src 'self'` policy with no `'unsafe-eval'`, the
`new Function` call that `resolveTemplate` relies on is blocked, so only the
precompiled path works. You cannot run a precompiled bundle and
`resolveTemplate` together when the policy forbids `'unsafe-eval'`: pick one.
The same trade-off appears in [hateoas-fragments.md](./hateoas-fragments.md#csp-and-resolvetemplate).

## Splitting components across files

You will not want every definition in one file. There are two ways to split,
and they differ in how the pieces reach the browser.

### Precompiled: many sources, one bundle

`tools/precompile.mjs` accepts multiple input files but always emits a single
bundle module. Splitting is for source maintainability, not on-demand network
loading; the browser still downloads one cacheable file.

```sh
node tools/precompile.mjs \
  app/jst/orders.html app/jst/cart.html app/jst/notices.html \
  --out public/jst/dist/components.js \
  --runtime ../jst.js
```

```html
<script type="module" src="/jst/jst.js"></script>
<script type="module" src="/jst/dist/components.js"></script>
```

The `--runtime` value is the import specifier the generated bundle uses to reach
`jst.js`, resolved relative to the bundle's own location, not your shell's
working directory. The default is `./jst.js`, which is correct only when the
bundle sits next to `jst.js`. The examples here use `../jst.js` because the
bundle lands in a `dist/` subdirectory one level below `jst.js`. Set it to
whatever path walks from the emitted bundle to `jst.js`, or the bundle's import
404s.

### resolveTemplate: one file per component, fetched on demand

`resolveTemplate` keeps each `app-*` component in its own file and fetches it
the first time an unknown element appears. This is a true lazy load, build-free,
and needs `'unsafe-eval'`.

```js
import { configure } from '/jst/jst.js';

configure({
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null;
    return `/jst/components/${name}.html`;
  },
});
```

```html
<!-- /jst/components/app-notice.html -->
<script type="jst" name="app-notice" props="message">
  <aside>$(message)</aside>
</script>
```

When `<app-notice>` first lands in the DOM, the runtime fetches that file,
registers the definition, and upgrades the element. See
[hateoas-fragments.md](./hateoas-fragments.md) for the lifetime and failure
behaviour.

## Configuration

```js
import { configure } from './jst.js';

configure({
  dev: location.hostname === 'localhost',
  autoRegister: true,
  autoRegisterRoot: document.getElementById('trusted-fragments'),
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null;
    return `/components/${name}.html`;
  },
});
```

`autoRegister: false` does not fully stop the `MutationObserver` when a
`resolveTemplate` resolver is also configured. With a resolver present the
observer keeps running so it can drive lazy resolution; what `autoRegister:
false` turns off is the auto-registration of `<script type="jst">` definitions
that arrive in inserted nodes. It does not turn off the scan that triggers
`resolveTemplate` for unknown custom elements. Only when both `autoRegister` is
false and no resolver is set does the observer never start.

JST morphs form controls as properties, not just attributes, so values,
checked state, selected options, focus, and caret position remain stable across
renders.

For explicit controlled components:

```html
<input .value="$(title)" oninput="$(e => el.emit('title', e.target.value))">
```

For local controlled shorthand:

```html
<input jst-model="title">
```

`jst-model` reads from the declared prop and updates `el[prop]` when the user
changes it. For parent-owned state, keep the explicit `.value` plus `oninput`
event pattern.

## State Updates

Direct property assignment publishes component state. For mutable references,
assigning the same object or array reference still renders because the
assignment is treated as the author's explicit publish signal:

```js
el.items.push(nextItem);
el.items = el.items;
```

For primitive values, identical assignments stay quiet. When the next value
depends on the current value inside an event handler, read the live element
property, not the value captured when the template rendered:

```html
<button onclick="$(() => el.count = (el.count || 0) + 1)">
  Add
</button>
```

## Lists

Add `jst-key` when identity matters:

```html
$ items.forEach(item => {
  <todo-row jst-key="$(item.id)" .item="$(item)"></todo-row>
$ })
```

Keys preserve DOM nodes across insertions and reorders, which protects focus,
form state, media elements, canvas nodes, and CSS transitions.

## Transitions

Use `jst-transition` to let CSS own enter, leave, and move styling:

```html
<li jst-key="$(item.id)" jst-transition="fade">$(item.text)</li>
```

JST adds and removes these classes:

- `fade-enter-from`, `fade-enter-active`, `fade-enter-to`
- `fade-leave-from`, `fade-leave-active`, `fade-leave-to`
- `fade-move`

Define the actual animation in CSS. JST only coordinates class phases and
delays removal until leave transitions finish.

## Teardown

Most templates should not need lifecycle code. When a template opens an external
resource, use `once(key, setup)` so setup is not re-registered on every render.
`once` defers `setup` to a microtask that runs after the render commits, so the
rendered DOM and projected slots are available, and registers the function
`setup` returns as disconnect cleanup:

```html
<script type="jst" name="clock-face" props="time">
  ${ once('tick', () => {
    const id = setInterval(() => el.emit('tick'), 1000)
    return () => clearInterval(id)
  }) }
  <time>$(time)</time>
</script>
```

`onDisconnect(fn)` is still available as the low-level teardown primitive, but
calling it directly from a template body will run on every render unless you
guard it yourself. See
[controlled-components.md](./controlled-components.md#hosting-a-third-party-widget)
for hosting a third-party widget with `once()` and a slot.

## Browser Support

JST depends on custom elements, ES modules, `MutationObserver`, `CustomEvent`,
and modern DOM APIs. Target evergreen browsers unless you add your own platform
polyfills.
