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
node tools/precompile.mjs components.html --out dist/templates.js --runtime ../jst.js
```

```html
<script type="module" src="/jst.js"></script>
<script type="module" src="/dist/templates.js"></script>
```

Use runtime mode for development and trusted streamed fragments. Use
precompiled mode for strict CSP and release builds.

Direct `file://` mode is planned, not shipped. The intended shape is a
classic/global build such as `jst.global.js` that a single HTML file can load
directly from disk.

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

## Forms

JST morphs form controls as properties, not just attributes, so values,
checked state, selected options, focus, and caret position remain stable across
renders.

For explicit controlled components:

```html
<input .value="$(title)" @input="$(e => el.emit('title', e.target.value))">
```

For local controlled shorthand:

```html
<input jst-model="title">
```

`jst-model` reads from the declared prop and updates `el[prop]` when the user
changes it. For parent-owned state, keep the explicit `.value` plus `@input`
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
<button @click="$(() => el.count = (el.count || 0) + 1)">
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
resource, use `once(key, setup)` so setup is not re-registered on every render:

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
guard it yourself.

## Browser Support

JST depends on custom elements, ES modules, `MutationObserver`, `CustomEvent`,
and modern DOM APIs. Target evergreen browsers unless you add your own platform
polyfills.
