# Controlled components

JST components are controlled: data flows in as properties, actions flow out as
events, and the state lives outside the component. A component is a renderer of
the inputs it is given, not an owner of state. This is the same discipline as
controlled form inputs in React, applied to every component.

## Props down

Declare props as a space-separated list of plain JS identifiers. Case is
preserved.

```html
<script type="jst" name="todo-item" props="item onToggle">
  <li class="$(item.done ? 'done' : '')">$(item.text)</li>
</script>
```

Inside the template you reference props as bare locals (`$(item)`) or off the
element (`el.item`). From outside, pass data in two ways:

- Attributes for simple values, kebab-case maps to camelCase:
  `<todo-item on-toggle="...">`. Attribute strings that look like JSON are
  parsed, so `count="0"` arrives as a number.
- Property bindings for rich values (objects, arrays, functions):
  `.item="$(obj)"`, `.onToggle="$(fn)"`.

```html
<todo-item .item="$(todo)" .onToggle="$(handleToggle)"></todo-item>
```

## Events up

A component reports what happened by emitting a bubbling, composed
`CustomEvent`:

```html
<script type="jst" name="todo-item" props="item">
  <li>
    $(item.text)
    <button @click="$(() => el.emit('remove', item))">×</button>
  </li>
</script>
```

The page (or a parent component) listens. Because events bubble and are composed,
a single listener up the tree can handle them:

```html
<ul @remove="$(e => removeTodo(e.detail.id))">
  <todo-item .item="$(...)"></todo-item>
</ul>
```

`@event` bindings attach a real `addEventListener`, and support modifiers in the
name: `.prevent .stop .self .once .capture .passive`, key guards like
`.enter`/`.escape`, `.debounce` / `.debounce.300`, and `.outside`.

## State lives outside

A controlled component holds no canonical state. To change what it shows, change
its input. You re-render a JST component by assigning a property:

```js
el.item = { ...el.item, done: true } // fresh object, re-renders
```

Primitives skip the re-render when unchanged. Objects and arrays always
re-render, because they may have been mutated under the same reference, so prefer
assigning a fresh value for immutable-style updates.

### Local form sugar for inputs

`jst-model` binds a form control to the component's **own** host property:

```html
<input jst-model="text">
```

reads `el.text` into the field and writes `el.text` back on input — local,
component-owned UI state (a draft value), not hidden parent state. When a parent
or the server owns the value, stay explicit: bind `.value="$(text)"` and report
changes with `@input="$(e => el.emit('text-change', e.target.value))"`, so the
boundary stays props-down / events-up. For checkboxes and selects, `jst-model`
reads and writes `el[prop]` via `.checked` / `.value` accordingly.

## Why this scales: push state to the server

Controlled components compose upward: the parent owns the children's state, and
its parent owns its state, until you reach the page. The natural top of that
chain is the server. In a HATEOAS app the server holds the canonical state and
ships HTML that reflects it (see [hateoas-fragments.md](./hateoas-fragments.md)).
Components stay dumb, the page stays thin, and the hard questions about state
consistency live in one place: the server. That is how a JST app scales without a
client store.

## When to reach for once() / onDisconnect()

Controlled and stateless covers most components. The exception is a component
that owns a resource: a timer, a subscription, an observer, an external widget.
For those, JST gives you two lifecycle primitives in template scope (also on the
element as `el.once` / `el.onDisconnect`):

- `once(key, setupFn)` runs `setupFn` exactly once per key for the lifetime of
  the connection. If `setupFn` returns a function, that runs as teardown on
  disconnect.
- `onDisconnect(fn)` registers a teardown to run on disconnect.

```html
<script type="jst" name="live-clock" props="label">
  $ once('tick', () => {
  $   const id = setInterval(() => el.emit('tick'), 1000)
  $   return () => clearInterval(id)
  $ })
  <time>$(label)</time>
</script>
```

Use `once()` so setup is not re-run on every render, and return the teardown so
the resource is released on disconnect. There is no `effect()` and no dependency
array, see [no-store-no-proxy.md](./no-store-no-proxy.md). `once` keys reset on
disconnect, so setup re-runs if the element reconnects.
