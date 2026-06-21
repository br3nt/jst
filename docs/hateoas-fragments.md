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

## Definitions ship once: the server's job

A fragment can carry its own definition, so the same `<script type="jst"
name="...">` block can arrive on more than one response. Sending each definition
only once is the server's responsibility, not a framework feature. Send the
definition on the first fragment that needs it and omit it afterwards, or rely
on `resolveTemplate` to fetch it once. The framework does not dedupe markup: it
only no-ops a second registration of the same name, warning
`JST: Duplicate template name "..." ignored.` to the console and keeping the
first definition. Treat that warning as a signal that a definition is shipping
more than it needs to, not as a deduplication guarantee.

## resolveTemplate lifetime and failure

Once `resolveTemplate` resolves a name and the definition registers, it is
cached for the lifetime of the page. The runtime checks
`customElements.get(name)` and its template registry before resolving, so a
registered component is never re-fetched and there is no cache-busting; a reload
is the only way to pick up a changed definition. In-flight resolutions for the
same name are also coalesced, so a tag appearing many times triggers one fetch.

A failed resolve currently fails silently. A resolver that returns a URL whose
fetch 404s (or any thrown error) logs to the console with
`JST: Failed to resolve template for <name>:` and renders nothing; the element
stays un-upgraded. There is no fallback content and no error event today.
Issue [#3](https://github.com/br3nt/jst/issues/3) proposes the intended
improvement: fire an event and allow error-target routing for a failed fragment
or `resolveTemplate` fetch, the same model htmx uses.

## CSP and resolveTemplate

`resolveTemplate` compiles the fetched definition in the browser with
`new Function`, so it needs `script-src 'self' 'unsafe-eval'`. The precompiled
bundle path (`tools/precompile.mjs`) is the strict-CSP alternative, and the two
cannot run together when the policy forbids `'unsafe-eval'`. See
[production.md](./production.md#choosing-between-the-two-no-inline-paths).

## Start with ordinary routes

JST does not require a client router. In a server-rendered app, use normal
resourceful URLs first:

- `GET /orders/4471`
- `GET /orders/4471/edit`
- `POST /orders/4471/items`
- `PATCH /orders/4471/items/8`

The browser can navigate to those pages just like any SSR app. CSS page
transitions and View Transitions can make full-page navigation feel polished
without turning the app into a SPA.

Fragments are an enhancement, not a replacement for routing. Use them when a
partial update is genuinely better: inline validation, an expanding row, a modal
body, a "load more" feed, or a component definition the page does not know yet.
Today you can fetch a fragment with plain JavaScript and insert it into a
trusted container. A small HTMX-inspired swap syntax may be worth adding later,
but the default model should stay close to RESTful HTML.

## Server templates

Because the wire format is HTML, backend templates can emit JST components
directly.

Rails ERB:

```erb
<script type="jst" name="task-row" props="taskId title done">
  <li class="$(done ? 'done' : '')" data-task-id="$(taskId)">
    $(title)
    <button @click="$(() => el.emit('complete', taskId))">Complete</button>
  </li>
</script>

<task-row
  task-id="<%= task.id %>"
  title="<%= h task.title %>"
  done="<%= task.done.to_json %>">
</task-row>
```

ASP.NET Razor:

```cshtml
<script type="jst" name="task-row" props="taskId title done">
  <li class="$(done ? 'done' : '')" data-task-id="$(taskId)">
    $(title)
    <button @@click="$(() => el.emit('complete', taskId))">Complete</button>
  </li>
</script>

<task-row
  task-id="@Model.Task.Id"
  title="@Model.Task.Title"
  done="@Json.Serialize(Model.Task.Done)">
</task-row>
```

Razor uses `@@click` above so it renders a literal JST `@click` attribute.

Fragments are code. Only load JST fragments from trusted sources.
