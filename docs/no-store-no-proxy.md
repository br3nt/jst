# No store, no proxy, no signals

JST has no global store, no proxies, no signals, and no dependency-array effects.
This is a deliberate design choice, not a missing feature. This page explains the
model and why it is the way it is.

## The model: assign a property, get a render

You change what a component shows by assigning one of its props:

```js
el.count = el.count + 1   // re-renders
el.items = [...el.items, newItem]   // re-renders
```

That is the whole reactivity model. No subscriptions, no tracked reads, no
diffing graph. The element schedules a render on the next microtask and morphs
its DOM in place.

### Equality-skip applies to primitives only

If you assign a primitive equal to the current value, JST skips the render to
avoid pointless work and cascades into children. Objects and arrays always
re-render, because they may have been mutated under the same reference and JST
cannot tell. So for immutable-style updates, assign a fresh reference:

```js
el.todo = { ...el.todo, done: true }   // fresh object: renders
el.todo.done = true                    // same ref: assign it back to render
el.todo = el.todo
```

## What JST does not have, and why

### No proxies

There is no proxy wrapping your data to watch reads and writes. Your objects are
your objects. Nothing rewrites their behaviour, nothing surprises you in the
debugger, and there is no proxy-identity confusion when you pass data around.

### No signals / auto-tracked effects

There is no `computed` that re-runs when its inputs change, and no effect that
auto-tracks dependencies. Derived values are just expressions in the template;
they are computed every render because render is cheap and predictable:

```html
$ const remaining = items.filter(i => !i.done).length
<p>$(remaining) left</p>
```

### No dependency-array effects

There is no `effect(fn, [deps])`. The only lifecycle primitives are `once(key,
setupFn)` and `onDisconnect(fn)`, for the rare component that owns a resource
(see [controlled-components.md](./controlled-components.md)). There is nothing to
get the deps wrong on, because there are no deps.

### No client store

State lives in the page or on the server, not in a framework-owned client
container. Components are controlled: props down, events up. In a small static
app, the page may own state directly. In a HATEOAS app, the server is usually the
canonical owner because it already owns persistence, validation, permissions, and
resource URLs (see [hateoas-fragments.md](./hateoas-fragments.md)).

## Just plain JS and the platform

The template language is JavaScript. `$(expr)` is an expression. `$ line` and
`${ }` are statements. Loops are `forEach`, conditionals are `if`. There is no
DSL to learn and no reactive runtime to reason about.

```html
<script type="jst" name="item-list" props="items">
  <ul>
    $ items.forEach(item => {
      <li jst-key="$(item.id)">$(item.label)</li>
    $ })
  </ul>
</script>
```

Under the hood it is real custom elements, real properties, real bubbling events,
and in-place DOM morphing. When something behaves oddly, you debug HTML, DOM, and
plain functions, not a framework's reactive graph.

## The trade-off, stated plainly

You give up automatic fine-grained reactivity and a batteries-included state
container. In return you get a model with no hidden machinery: predictable
renders, ordinary data, and a small surface area. If your app wants the magic,
JST is the wrong tool, and that is fine (see
[avoid-jst-when.md](./avoid-jst-when.md)).
