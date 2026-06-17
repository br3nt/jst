# JST primer — for building parity examples

JST is a tiny no-build component framework. A
`<script type="jst" name="tag-name" props="...">` becomes a real custom
element. Read this fully before building examples.

**HARD RULE: never modify JST core** (`/jst.js`, `/compiler.js`, `/interpreter.js`,
`/lexer.js`, `/input_reader.js`, `/tokens.js`, `/parser.js`). If something can't be
done, that's a finding — mark it `(i)` or `✗`. Do not "fix" it by editing the framework.

## Defining a component

```html
<script type="jst" name="my-counter" props="count label">
  <div>
    <strong>$(label)</strong>: $(count)
    <button @click="$(() => el.count = (el.count || 0) + 1)">+</button>
  </div>
</script>

<my-counter count="0" label="Clicks"></my-counter>
```

- `props="count label"` declares case-preserved **props** available as bare
  locals inside the template.
- Each prop is also a **property**: `el.count = 5` updates and re-renders.
- External multi-word HTML attributes use kebab-case and map to camelCase props:
  `on-toggle` -> `onToggle`.

## Template syntax

| Syntax | Meaning |
|---|---|
| `$(expr)` | Interpolate, **HTML-escaped** by default |
| `$(raw(expr))` | Interpolate without escaping (opt-in; only for trusted HTML) |
| `$identifier` | Shorthand interpolation of a single identifier |
| `$ statement` | A line of JS (to end of line). Use for `if`, `for`, `const`, loops |
| `${ … }` | A block of JS |
| `$$` | A literal `$` |
| `.prop="$(expr)"` | Set a **JS property** on the child element to expr's value (pass rich data/objects) |
| `@event.mod="$(fn)"` | `addEventListener('event', fn)` with modifiers like `.prevent`, `.stop`, `.enter`, `.outside`, `.debounce.300` |
| `jst-model="prop"` | Local form shorthand: read from `prop`, update `el[prop]` on user input |
| `jst-key="$(id)"` | Preserve DOM identity during list inserts/reorders |
| `$(slot())` | Project the component's original child nodes (default slot) |
| `$(slot('name', 'fallback'))` | Project children marked `slot="name"`, else fallback |
| `onDisconnect(fn)` | Register teardown when the component disconnects |

Inside a template you can use the props by name plus these globals:
- `el` — the component element instance. `el.emit(name, detail)`, `el.querySelector(...)`, `el.count = …`.
- `raw(value)` / `unsafeHTML(value)` — wrap a trusted string so it is NOT escaped.
- `slot(name?, fallback?)` — slot projection (see above).
- `onDisconnect(fn)` — cleanup timers, observers, or external listeners.

### Control flow examples

```html
<script type="jst" name="x-list" props="items filter">
  $ const shown = (items || []).filter(i => !filter || i.kind === filter);
  <ul>
    $ shown.forEach(item => {
      <li jst-key="$(item.id)">$(item.title)</li>
    $ })
  </ul>
  $ if (shown.length === 0) {
    <p>Nothing here.</p>
  $ }
</script>
```

## The data model — this is the important part

**Props down, events up.** Components are renderers.

- **Data IN, two ways:**
  - *Attributes* — strings, JSON-parsed for primitives: `count="0"` → number `0`,
    `active="true"` → boolean, `items='[1,2,3]'` → array. Plain text stays a string.
  - *Properties* — for rich data: `el.items = [{...}]` (re-renders). Inside a parent
    template, pass rich data to a child with `.items="$(theArray)"`.
- **Data OUT:** `el.emit('change', detail)` dispatches a **bubbling** `CustomEvent`.
  Parents/pages listen with `addEventListener('change', e => … e.detail …)`.
- **Local state:** a component can update *its own* props:
  `@click="$(() => el.count = (el.count || 0) + 1)"` re-renders it.
  This is how you build self-contained interactive widgets (Alpine/Vue style).
- **Shared/app state:** keep it in the page (a plain JS object/array); pass down via
  properties, mutate on events, reassign to re-render.

## Late-arriving components (the "server sends components" trick)

JST runs a `MutationObserver`: any `<script type="jst">` inserted **after load** is
auto-registered. So you can `fetch()` an HTML fragment that contains BOTH a new
component definition and markup using it, insert it, and it renders. This is how we
reproduce HTMX "server returns HTML" examples without a real backend (see mock-fetch).

## Front-end "backend": mock-fetch

Include `/framework_parity/lib/mock-fetch.js`. It intercepts `window.fetch` with a
route table you define inline, returning HTML fragments (which may contain JST) or JSON.

```html
<script src="/framework_parity/lib/mock-fetch.js"></script>
<script>
  JSTMock.route('GET /api/quote', () => `<blockquote>$(text)</blockquote>`); // returns text
  JSTMock.route('POST /api/contact/:id', async (req) => {
    const body = req.form;            // parsed form/urlencoded/JSON body
    return { json: { ok: true, id: req.params.id, name: body.name } };
  }, { delay: 200 });                 // optional simulated latency
</script>
```
Handler return value:
- a **string** → `text/html` response,
- `{ json }` → JSON response,
- `{ status, body, headers }` → full control.
`req` = `{ method, url, params, query, form, raw }`.

## Known gaps to expect (classify honestly)

These are likely `(i)` (workaround) or `✗`. Don't paper over them.
- **No full transition directive yet** (`x-transition`, Vue `<transition>`):
  use CSS classes and keyed DOM identity manually.
- **No computed/watch primitives**: compute with `$ const … =` in the template; "watch" by acting in the event that changes state.
- **Coarse re-render**: setting any prop re-renders the whole component (fine for these examples).
- **No router, no scoped styles** (light DOM; use normal CSS).

## House style for examples

- Each example is ONE self-contained `.html` file under `framework_parity/<framework>/`.
- Load JST with `<script type="module" src="/jst.js"></script>` (absolute path).
- Put a short header comment: the source URL, what it demonstrates, and the JST status.
- Keep them small and focused on the ONE feature being matched.
- Add `id`s / data-testids on key elements so they can be validated headlessly.
- Set `window.__exampleReady = true` at the end of inline setup so the validator knows it loaded.
