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
  <li class="$(item.done ? 'done' : '')">
    $(item.text)
    <button @click.stop="$(() => onToggle(item))">Toggle</button>
  </li>
</script>
```

Inside the template you reference props as bare locals (`$(item)`) or off the
element (`el.item`). From outside, pass data in two ways:

- Attributes for simple values, kebab-case maps to camelCase:
  `<todo-item on-toggle="...">`. Attribute strings that look like JSON are
  parsed, so `count="0"` arrives as a number.
- JavaScript properties for rich values (objects, arrays, functions):
  `element.item = obj`, `element.onToggle = fn`.

```html
<todo-item id="todo-1"></todo-item>

<script>
  const row = document.getElementById('todo-1');
  row.item = todo;
  row.onToggle = handleToggle;
</script>
```

Inside another JST template, use property bindings:

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
    <button @click="$(() => el.emit('remove', item))">x</button>
  </li>
</script>
```

The page can listen with normal DOM APIs:

```js
document.querySelector('todo-list').addEventListener('remove', event => {
  removeTodo(event.detail.id);
});
```

A parent JST component can listen with `@event`. Because events bubble and are
composed, a single listener up the tree can handle them:

```html
<ul @remove="$(e => removeTodo(e.detail.id))">
  <todo-item .item="$(...)"></todo-item>
</ul>
```

`@event` bindings attach a real `addEventListener`, and support modifiers in the
name: `.prevent .stop .self .once .capture .passive`, key guards like
`.enter`/`.escape`, `.debounce` / `.debounce.300`, and `.outside`.

There is no separate `events="..."` declaration today. DOM events are open by
design: emit them with `el.emit(...)`, listen with `@event`, and let tooling
learn common names from templates. Function callbacks such as `onToggle` are just
props; use them when a direct callback is clearer than bubbling an event.

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

reads `el.text` into the field and writes `el.text` back on input - local,
component-owned UI state (a draft value), not hidden parent state. When a parent
or the server owns the value, stay explicit: bind `.value="$(text)"` and report
changes with `@input="$(e => el.emit('text-change', e.target.value))"`, so the
boundary stays props-down / events-up. For checkboxes and selects, `jst-model`
reads and writes `el[prop]` via `.checked` / `.value` accordingly.

## Why this scales: push state to the server

Controlled components compose upward: the parent owns the children's state, and
its parent owns its state, until you reach the page. For a static page or a small
tool, the page can be the owner. In a HATEOAS app, the natural top of that chain
is the server: it owns canonical state, persists it, and ships HTML that reflects
it (see [hateoas-fragments.md](./hateoas-fragments.md)). Components stay dumb,
the page stays thin, and the hard questions about state consistency live in one
place.

## When to reach for once() / onDisconnect()

Controlled and stateless covers most components. The exception is a component
that owns a resource: a timer, a subscription, an observer, an external widget.
For those, JST gives you two lifecycle primitives in template scope (also on the
element as `el.once` / `el.onDisconnect`):

- `once(key, setupFn)` runs `setupFn` once per key for the lifetime of the
  connection, after the render commits. If `setupFn` returns a function, that
  function runs as teardown on disconnect.
- `onDisconnect(fn)` registers a teardown to run on disconnect.

### Render passes and the committed DOM

A template body runs in two distinct moments. The body itself is a string-build
pass: JST evaluates every `$(expr)` and `${ ... }` block to assemble the HTML.
This happens before the rendered DOM and any projected slot nodes exist. Only
after that string is built does JST commit it, morph the DOM, and fill slots.

So an inline block cannot read the component's own rendered output:

```html
${ const node = el.querySelector('.thing') }  // null: nothing is rendered yet
```

`once(key, setupFn)` bridges the gap. The current runtime defers `setupFn` to a
microtask that runs after the render commits, so the rendered DOM and projected
slots are present:

```html
${ once('init', () => {
  const node = el.querySelector('.thing')   // present now
  // ... wire it up ...
  return () => { /* teardown */ }            // registered as disconnect cleanup
}) }
```

`setupFn` runs once per connection, and the function it returns is registered as
disconnect cleanup, so you never wire teardown by hand. A synchronous
disconnect then reconnect discards the stale setup. `once` keys reset on
disconnect, so setup re-runs if the element reconnects.

### Inline `${ ... }` vs once()

Pick by whether you need the committed DOM.

- Inline `${ ... }` runs synchronously during every render pass, before commit.
  Use it for pure computation that feeds the template: deriving a value,
  branching, building a list.
- `once()` runs once, after commit, with cleanup. Use it for anything that
  reaches into the rendered DOM or sets up a resource: a timer, subscription,
  observer, or third-party widget.

```html
<script type="jst" name="live-clock" props="label">
  ${ once('tick', () => {
    const id = setInterval(() => el.emit('tick'), 1000)
    return () => clearInterval(id)
  }) }
  <time>$(label)</time>
</script>
```

There is no `effect()` and no dependency array, see
[no-store-no-proxy.md](./no-store-no-proxy.md).

### Hosting a third-party widget

A rich-text editor, chart, or map manages its own DOM subtree. JST's morpher
reconciles child nodes on every re-render, so it will fight any widget whose
nodes live inside a re-rendered region; the morpher removes or rewrites the
widget's DOM out from under it.

Keep the widget's subtree out of the morphed region by passing its mount element
in as a slot. Projected slot nodes are the element's original children. JST
detaches them before morphing and re-projects the same node references after, so
they are never recreated. Instantiate the widget in `once()`, once the slot is
in place:

```html
<script type="jst" name="rich-editor">
  $(slot('content'))
  ${ once('editor', () => window.MyEditor.mount(el)) }   // mount returns its teardown
</script>

<rich-editor><div slot="content"></div></rich-editor>
```

The editor mounts into the projected `<div slot="content">`, which survives
every re-render intact, and `mount` returns the teardown that `once()` registers
for disconnect. If you instead wrote the mount element directly in the template
body, the morpher would own those nodes and rewrite them on the next render,
corrupting the widget. The slot is the boundary that keeps the two apart.
