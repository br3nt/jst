# Use JST when

JST is a no-build web-components framework. It shines when HTML is the contract
between server and client and you want interactive behaviour without a bundler,
a virtual DOM, or a client-side state store. Here are the niches it fits.

The strongest pitch is not "smaller React." It is that the backend and frontend
can speak the same UI format. The server can return HTML, the browser can render
that HTML, and if the response includes a new JST component definition, the
component can register and become interactive when it arrives. That removes a
layer of duplicated DTO/view-model/template work for apps that are naturally
resourceful and hypermedia-shaped.

## Static sites and docs

You have HTML files and you want a few interactive widgets: a copy button, a
tabbed code sample, a search box, a theme toggle. Drop in `jst.js` and declare
the components inline. No bundler, no `node_modules`, no watch process.

```html
<script type="module" src="/jst.js"></script>

<script type="jst" name="copy-button" props="text">
  <button @click="$(() => navigator.clipboard.writeText(text))">Copy</button>
</script>

<copy-button text="npm i jst"></copy-button>
```

The components are real custom elements, so they keep working if you later move
the page behind a static host or a CDN.

## Server-rendered apps with interactive islands

You render HTML on the server (Rails, Django, Laravel, Go templates, whatever)
and you want pockets of client interactivity without shipping a SPA. Render the
page as you always have, then sprinkle in JST components for the parts that need
to react. State stays where it already lives: in the page and on the server.

```html
<article>
  <h1>Order #4471</h1>
  <line-items id="order-lines"></line-items>
  <quantity-stepper value="2"></quantity-stepper>
</article>

<script>
  document.getElementById('order-lines').items = orderItems;
</script>
```

Each island is a controlled component: data flows in as properties, actions flow
out as events. The page (or a small page-level script) owns the wiring.

## HATEOAS apps

This is the headline use case. Your server responds with HTML that carries its
own next actions and, when needed, its own component definitions. A fetched
fragment can both define a `<script type="jst">` component and use it in the same
response. JST auto-registers new templates via a `MutationObserver`, so the
fragment upgrades itself the moment it lands in the DOM. See
[hateoas-fragments.md](./hateoas-fragments.md).

Use ordinary links and forms for whole-resource navigation. Add fragment swaps
only where they improve the interaction. JST should complement RESTful routing,
not replace it with deep client routing.

## HTML fragments that bring their own behaviour

Any time you ship a chunk of HTML that needs to do something, a notification
toast, an inline editor, an expandable row, JST lets that fragment carry its
behaviour with it instead of relying on a global script to find and wire it up.
The fragment is self-contained: it declares its component and uses it.

## When the platform is enough

If your reach for a framework is really a reach for "I want components and
events without a build step," JST is a thin layer over custom elements,
properties, bubbling events, and DOM morphing. You get authoring ergonomics
without leaving the platform.

## Not sure?

If your app is large, client-owned, and routes/state live entirely on the
client, read [avoid-jst-when.md](./avoid-jst-when.md) first. JST has opinions,
and they cut against that shape.
