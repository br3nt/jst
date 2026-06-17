# HATEOAS over a Service Worker — HTML is the shared UI contract

A working demo of JST's headline pitch: **the wire format is the UI.** A
"server" returns HTML fragments that *are* the interface. Each response carries
its own next actions (HATEOAS) **and** its own front-end behaviour, because a
fragment can include a `<script type="jst">` component definition that
auto-registers the moment it is inserted into the page.

No JSON. No separate client app to re-render anything. No build step. And no
real backend — a **service worker** plays the server, so the whole thing runs as
static files.

## What to look at (the three moving parts)

1. **`index.html`** — the page. It defines **no application components at all**.
   Its "client" is six lines: `fetch(url).then(r => r.text()).then(html => target.innerHTML = html)`.
   Plus one delegated click handler that follows the next-action links the
   server embeds in its fragments.

2. **`service-worker.js`** — the mock backend. It intercepts `fetch()` for the
   `/api/` namespace and answers with `text/html` **fragments**, holding its
   "data" in memory. Routes:
   - `GET  api/feed?page=N` → a page of posts.
   - `POST api/item/:id/like` → a like badge.
   - `GET  api/item/:id/likers` → the list of likers.

3. **`../../jst.js`** — the framework. Importing it starts a `MutationObserver`,
   so any `<script type="jst">` that arrives later (inside a fetched fragment)
   registers itself, and the custom elements beside it come alive immediately.

## The two things this demonstrates

### Define-and-use over the wire

The page never defines `feed-item`. Its definition arrives with the **first**
`api/feed` response, alongside the markup that uses it (`<feed-item item='…'>`).
JST sees the inserted `<script type="jst" name="feed-item">`, registers the
custom element, and the `<feed-item>`s render themselves.

The clearest proof is the **Like** button. The `like-badge` component does not
exist *anywhere* — not in the page, not in any earlier response — until you
click Like. That single response carries **both** a brand-new
`<script type="jst" name="like-badge">` definition **and** a `<like-badge>` that
uses it. Define-and-use, on demand, triggered by interaction. (Open DevTools →
Console to watch `JST: Registered <feed-item>` / `<like-badge>` print as the
definitions arrive. Network → look at the responses: they are HTML, not JSON.)

Definitions ship **once**: subsequent pages of the feed send only the
`<feed-item>` elements, because the worker remembers it already shipped the
definition.

### Responses carry their own next actions (HATEOAS)

The client hardcodes only the entry URL (`api/feed`). Everything after that, it
learns from the responses:

- **Load more** is a `<button data-action="load-more" data-href="api/feed?page=2">`
  *inside* the returned markup. The client just follows the `data-href` it is
  handed. Each "more" response brings the *next* button with it; the final page
  sends no button, so the affordance simply disappears.
- **see who** lives inside the `like-badge` fragment and points at
  `api/item/:id/likers`, another fragment the client injects.

The behaviour for the in-component buttons (Like, see who) is shipped *in the
fragment* via JST `@event` bindings — so the fragment carries its interactivity,
not just its appearance.

## Running it

Service workers and ES module scripts require `http://` (not `file://`) and a
secure context (`localhost` counts). From the **repository root**:

```sh
python3 -m http.server 8000
```

Then open: <http://localhost:8000/demo/hateoas/>

On the very first visit the page reloads itself once — that is expected. The
service worker has to take control before it can intercept `/api/` requests, so
the page waits for `controllerchange` and reloads so the first feed fetch is
served by the worker.

To reset the demo (clear the in-memory likes / re-ship definitions): unregister
the worker in DevTools → Application → Service Workers, or just hard-reload — the
worker's state is intentionally ephemeral.

## Security boundary

Fetched JST templates are **application code**: a `<script type="jst">` fragment
defines real custom elements with real event handlers. So this pattern is only
safe for **same-origin, trusted fragments** — exactly what a service worker (or
your own backend) provides. Treat a JST fragment from an untrusted origin the
same way you would treat a remote `<script>`: don't inject it.

JST still gives you defence in depth for the *data* inside trusted fragments:

- `$(expr)` HTML-escapes by default, so post text (`$(item.body)`) cannot inject
  markup. You opt out explicitly with `$(raw(x))` / `$(unsafeHTML(x))`.
- `$(url(x))` guards `href`/`src` against dangerous schemes. The demo includes a
  post whose `source` is a `javascript:` URL on purpose — `url()` rewrites it to
  `#`, so the "Source" link is inert. (Try clicking it.)
- User-supplied data is escaped into the fragments the worker emits; structured
  data rides as a JSON-in-attribute (`item='{…}'`), which JST parses into the
  `item` prop.
