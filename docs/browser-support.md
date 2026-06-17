# Browser support

JST targets modern evergreen browsers and uses platform features directly. There
is no transpilation and no polyfill layer.

## What it needs

JST relies on these platform features:

- Custom Elements v1 (`customElements.define`, `connectedCallback`,
  `attributeChangedCallback`, `observedAttributes`). Every `<jst-*>` is a real
  custom element.
- ES modules (`<script type="module">` and `import`). `jst.js` and its siblings
  load as modules.
- `MutationObserver`, for auto-registering templates that arrive after load (see
  [hateoas-fragments.md](./hateoas-fragments.md)).
- `queueMicrotask`, for batching renders onto the microtask queue.
- `CustomEvent` with `bubbles` and `composed`, for `el.emit`.

These are all baseline in current Chrome, Edge, Firefox, and Safari.

## What it does not support

- Internet Explorer. None of it. IE has no custom elements v1, no ES modules,
  and no `queueMicrotask`. There is no polyfill path provided.
- Very old pre-evergreen browsers that predate custom elements v1.

## CSP note

Under the default browser compiler, JST uses `new Function`, which Content
Security Policy treats as eval. This is a CSP consideration, not a browser
compatibility one. See [production.md](./production.md) and
[security-model.md](./security-model.md).

## Practical guidance

If you target the current and recent versions of the major evergreen browsers,
you are fine. If you must support IE or other legacy engines, JST is not the
right tool, and no shim is provided to make it one.
