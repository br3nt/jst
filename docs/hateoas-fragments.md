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
