# HATEOAS Fragments

JST's unusual feature is that a server response can ship both a component
definition and component markup.

```html
<script type="jst" name="app-notice" props="message level">
  <aside class="notice $(level)">$(message)</aside>
</script>

<app-notice level="info" message="Saved"></app-notice>
```

When that fragment is inserted into a trusted auto-register root, JST registers
the template and upgrades the `<app-notice>` element. If the component is not
already known, `resolveTemplate(name)` can lazily fetch it.

```js
JST.configure({
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null;
    return `/components/${name}.html`;
  },
});
```

This keeps the backend and frontend from maintaining parallel render
representations. The server can return hypermedia; the browser can still attach
client behavior through the same component syntax.

Fragments are code. Only load JST fragments from trusted sources.
