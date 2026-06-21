# Writing JST

This is the practical authoring guide. It assumes you have `jst.js` available
next to your page or served from your app.

## 1. Load the runtime

Runtime mode loads one ES module:

```html
<script type="module" src="/jst.js"></script>
```

The runtime finds every `<script type="jst">` template already in the document,
registers each one as a custom element, and watches for trusted templates that
arrive later.

## 2. Define a component

A JST component is a `<script type="jst">` block with:

- `name`: the custom element tag name. It must contain a hyphen.
- `props`: a space-separated list of JavaScript identifiers available inside the
  template.

```html
<script type="jst" name="hello-name" props="name count">
  <p>Hello, <strong>$(name)</strong>.</p>
  <button @click="$(() => el.count = (el.count || 0) + 1)">
    Clicked $(count || 0) times
  </button>
</script>
```

Inside the template:

- `name` and `count` are bare locals.
- `el` is the live custom element instance.
- Assigning `el.count = ...` publishes a new prop value and schedules a render.

## 3. Use a component in normal HTML

In normal top-level HTML, pass simple values as attributes:

```html
<hello-name name="JST" count="0"></hello-name>
```

Attribute values that look like JSON are parsed:

- `count="0"` becomes number `0`.
- `open="true"` becomes boolean `true`.
- `label="hello"` stays a string.

The parser tries `JSON.parse` first and falls back to the raw string, so the
coercion is eager and applies to any JSON-looking value. `title="123"` arrives
as the number `123`, not the string `"123"`; `version="1.0"` arrives as the
number `1` (JSON parses `1.0` to `1`); and an identifier like `id="0123"` loses
its leading zero. Pass rich data and any string that must stay a string,
identifiers and version numbers especially, as a property, which skips JSON
coercion:

```js
el.version = "1.0"; // stays the string "1.0"
el.code = "0123";   // stays the string "0123"
```

This trap is also listed in [known-gaps.md](./known-gaps.md#attribute-coercion-is-eager-shipped-know-the-trap).

Avoid prop names that clash with native HTML attributes. A prop named `title`
also drives the browser's native `title` tooltip, and names like `id`, `class`,
`style`, and `hidden` carry their platform behavior whatever your component does
with them. Choose prop names that do not shadow native attributes.

Multi-word props use kebab-case in HTML attributes:

```html
<user-card user-name="Ada"></user-card>
```

The prop is still declared and used as `userName`:

```html
<script type="jst" name="user-card" props="userName">
  <p>$(userName)</p>
</script>
```

## 4. Pass objects and callbacks

Use element properties for rich data: objects, arrays, functions, DOM nodes,
classes, or anything that should not be stringified.

From ordinary page JavaScript:

```html
<todo-list id="todos"></todo-list>

<script>
  const list = document.getElementById('todos');
  list.items = [
    { id: 1, text: 'Write docs', done: false },
    { id: 2, text: 'Ship it', done: false },
  ];
</script>
```

Inside another JST template, use `.prop="$(expr)"`:

```html
<script type="jst" name="todo-list" props="items">
  <ul>
    $ (items || []).forEach(item => {
      <todo-item jst-key="$(item.id)" .item="$(item)"></todo-item>
    $ })
  </ul>
</script>
```

Important: `.prop="$(expr)"` and `@event="$(fn)"` are JST template syntax. They
are compiled only inside `<script type="jst">`. They do not run in raw top-level
HTML.

## 5. Template syntax

| Syntax | Meaning |
|---|---|
| `$(expr)` | Evaluate JavaScript and HTML-escape the result. |
| `$identifier` | Shorthand for `$(identifier)`. |
| `$$` | Literal dollar sign. |
| `$ statement` | A JavaScript statement line. |
| `${ ... }` | A JavaScript block. |
| `.prop="$(expr)"` | Set a JavaScript property on the rendered element. |
| `@event="$(fn)"` | Add an event listener to the rendered element. |
| `jst-key="$(id)"` | Preserve DOM identity across list changes. |
| `jst-model="prop"` | Local form shorthand: read/write `el[prop]`. |
| `$(slot())` | Project original child nodes. |

Example with control flow:

```html
<script type="jst" name="todo-list" props="items filter">
  $ const visible = (items || []).filter(item => {
  $   if (filter === 'done') return item.done;
  $   if (filter === 'active') return !item.done;
  $   return true;
  $ });

  <ul>
    $ visible.forEach(item => {
      <li jst-key="$(item.id)">$(item.text)</li>
    $ })
  </ul>
</script>
```

## 6. Events

For reusable controlled components, emit what happened and let the parent/page
decide what state changes.

```html
<script type="jst" name="todo-item" props="item">
  <li class="$(item.done ? 'done' : '')">
    <input
      type="checkbox"
      .checked="$(item.done)"
      @change="$(() => el.emit('toggle', item))">
    $(item.text)
  </li>
</script>
```

The page can listen with normal DOM APIs:

```js
document.querySelector('todo-list').addEventListener('toggle', event => {
  console.log(event.detail);
});
```

Or a parent JST component can listen with `@event`:

```html
<todo-item
  .item="$(item)"
  @toggle="$(event => el.emit('toggle', event.detail))">
</todo-item>
```

Supported modifiers include:

- `.prevent`, `.stop`, `.self`
- `.once`, `.capture`, `.passive`
- key filters such as `.enter`, `.escape`
- `.debounce` / `.debounce.300`
- `.outside`

## 7. State updates

Assigning a declared prop property renders:

```js
counter.count = counter.count + 1;
```

For objects and arrays, assigning the same reference is treated as an explicit
publish signal:

```js
list.items.push(nextItem);
list.items = list.items;
```

Immutable updates also work:

```js
list.items = [...list.items, nextItem];
```

## 8. Forms

For parent-owned state, keep the boundary explicit:

```html
<input
  .value="$(title)"
  @input="$(event => el.emit('title-change', event.target.value))">
```

For local draft state inside the component, use `jst-model`:

```html
<input jst-model="title">
```

`jst-model="title"` reads from `el.title` and writes back to `el.title` when the
user edits the field. It supports text inputs, textareas, checkboxes, radio
buttons, single selects, and multiple selects.

## 9. Lists and keys

Use `jst-key` whenever a list can insert, remove, or reorder items:

```html
$ items.forEach(item => {
  <li jst-key="$(item.id)">$(item.text)</li>
$ })
```

Keys preserve the matching DOM node, which protects focus, typed input, media
state, canvas state, and transitions.

## 10. Slots

Slots project the custom element's original children:

```html
<script type="jst" name="app-panel" props="title">
  <section>
    <h2>$(title)</h2>
    <div class="body">$(slot())</div>
    <footer>$(slot('footer', ''))</footer>
  </section>
</script>

<app-panel title="Hello">
  <p>Main content</p>
  <button slot="footer">Save</button>
</app-panel>
```

## 11. Trusted HTML and URLs

Interpolation is escaped by default:

```html
<p>$(userInput)</p>
```

Use `url(value)` for URL-bearing attributes:

```html
<a href="$(url(link.href))">$(link.label)</a>
```

Use `trustedHTML(value)` only for HTML that your app already trusts or
sanitizes:

```html
<article>$(trustedHTML(renderedMarkdown))</article>
```

`raw(value)` and `unsafeHTML(value)` remain compatibility aliases, but
`trustedHTML()` is the name to teach first.

## 12. Lazy templates and HATEOAS fragments

A fetched HTML fragment can include a component definition and the markup that
uses it:

```html
<script type="jst" name="app-notice" props="message">
  <aside>$(message)</aside>
</script>

<app-notice message="Saved"></app-notice>
```

When inserted into a trusted auto-register root, the template registers and the
element upgrades. For stricter apps, scope or disable auto-registration:

```js
JST.configure({
  autoRegisterRoot: document.getElementById('trusted-fragments'),
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null;
    return `/components/${name}.html`;
  },
});
```

## 13. Lifecycle: inline blocks vs once()

A template body runs as a string-build pass before its DOM is committed. Inline
`${ ... }` blocks and `$(expr)` evaluate during that pass, on every render, and
cannot see the component's own rendered DOM or projected slots yet. Use them for
pure computation that feeds the template.

`once(key, setup)` defers `setup` to a microtask that runs after the render
commits, so the rendered DOM and slots are present. It runs once per connection
and registers the function `setup` returns as disconnect cleanup:

```html
<script type="jst" name="chart-card" props="data">
  $(slot('canvas'))
  ${ once('chart', () => {
    const chart = window.MyChart.mount(el)
    return () => chart.destroy()      // runs on disconnect
  }) }
</script>

<chart-card><canvas slot="canvas"></canvas></chart-card>
```

Reach for `once()` whenever you touch the rendered DOM or set up a resource: a
timer, subscription, observer, or third-party widget. Host a widget through a
slot so the morpher does not recreate its nodes on re-render. See
[controlled-components.md](./controlled-components.md#hosting-a-third-party-widget)
for the full pattern. Calling `window.MyChart` here is a global bridge, because a
template cannot `import`; keep it to one named object (see
[known-gaps.md](./known-gaps.md)). Before wrapping a library this way, check that
the surface needs a component at all
([decision-guide.md](./decision-guide.md#component-granularity)).

## Common mistakes

- Custom element names must include a hyphen: `todo-item`, not `todo`.
- Declare every prop in `props="..."`.
- Use camelCase in `props`, kebab-case in normal HTML attributes.
- Remember that `.prop` and `@event` bindings only compile inside JST templates.
- Add `jst-key` to real lists.
- Use `trustedHTML()` only for trusted HTML.
- Avoid prop names that clash with native HTML attributes such as `title`.
- Use `once()`, not an inline `${ ... }` block, to touch the rendered DOM.
- Do not wrap a third-party library in a slot-only component; inline it instead.
- A static form or markup with a handler needs no component; server-render it and
  wire it from a module by selector.
- Serve module builds over HTTP; direct `file://` needs a future global build.
