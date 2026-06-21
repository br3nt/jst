# Integration guide

How to wire JST into a server so the same app can ship full pages, HTML
fragments, and the component definitions those fragments use. JST stays a
client runtime; the server owns routing, state, and HTML. This guide gives a
framework-agnostic loop first, then concrete patterns per framework.

## The loop, in the abstract

Every integration is the same five concerns. A request comes in, the server
returns HTML, JST upgrades the custom elements in it.

1. Serve `jst.js` undigested. The runtime is an ES module that imports its
   siblings (`./compiler.js`, `./interpreter.js`, and so on) with relative
   specifiers. A pipeline that fingerprints filenames breaks that import graph,
   so serve the JST module files from one static, non-digested directory. See
   [install.md](./install.md#asset-pipelines-and-digested-filenames).
2. Render a page that loads the runtime. One module script tag in the document
   head is the whole client install.
3. Make component definitions reachable. Pick one of three:
   - inline-once - the page (or the first fragment that needs it) carries the
     `<script type="jst" name="...">` definition.
   - resolveTemplate - the page configures a resolver and the runtime fetches
     each `app-*` definition on demand, build-free, needs `unsafe-eval`.
   - precompiled bundle - a build step compiles every definition into one ES
     module the page loads alongside `jst.js`, strict-CSP-safe.
4. Return resourceful HTML for navigation and fragments for partial updates.
   Both are just HTML; a fragment is a partial that may carry a definition.
5. Place `configure()` and set CSP headers to match the choice in step 3.

Framework-agnostic pseudocode for the whole loop:

```
# Static assets: serve the JST module directory verbatim, no digesting.
route GET "/jst/*path":
    return static_file("vendor/jst/" + path,
                       content_type="text/javascript")

# A full page: load the runtime, optionally a precompiled bundle, configure once.
route GET "/orders/:id":
    order = db.find_order(id)
    return html_page("""
      <head>
        <script type="module" src="/jst/jst.js"></script>
        <!-- precompiled path only: -->
        <!-- <script type="module" src="/jst/dist/components.js"></script> -->
        <script type="module">
          import { configure } from '/jst/jst.js'
          configure({
            dev: false,
            // resolveTemplate path only:
            resolveTemplate(name) {
              if (!name.startsWith('app-')) return null
              return `/jst/components/${name}.html`
            },
          })
        </script>
      </head>
      <body>
        <!-- inline-once path: ship the definition with the markup that uses it -->
        <script type="jst" name="order-line" props="line">
          <li>$(line.title) - $(line.qty)</li>
        </script>
        """ + render_order(order))

# A fragment: a partial that the client fetches and inserts into a trusted root.
route POST "/orders/:id/items":
    order = db.add_item(id, params)
    # Returns just the new row; may carry its definition if the page lacks it.
    return render_order_line(order.lines.last)

# A single component definition, for the resolveTemplate path.
route GET "/jst/components/:name.html":
    return static_file("components/" + name + ".html",
                       content_type="text/html")
```

CSP, in the abstract:

- inline-once and resolveTemplate compile templates in the browser with
  `new Function`, so the policy needs `script-src 'self' 'unsafe-eval'`.
- precompiled has no `new Function`, so it runs under strict
  `script-src 'self'`.

The two "don't inline everything" features are mutually exclusive under a
strict policy: a precompiled bundle and `resolveTemplate` cannot both run when
`script-src 'self'` forbids `unsafe-eval`. See
[production.md](./production.md#choosing-between-the-two-no-inline-paths).

## Rails

The most detailed walk-through, because Propshaft's digesting is the common
trap.

### Serve the runtime from public/

Propshaft fingerprints assets under `app/assets`, rewriting `jst.js` to a
digested name while leaving its internal `import './compiler.js'` untouched, so
the import 404s. Put the JST module files where Propshaft does not touch them:

```
public/
  jst/
    jst.js
    compiler.js
    interpreter.js
    lexer.js
    parser.js
    tokens.js
    utils.js
    input_reader.js
```

Files under `public/` are served verbatim at the matching path, so
`/jst/jst.js` keeps asking for `/jst/compiler.js` and the relative imports stay
intact. Load it in the layout:

```erb
<%# app/views/layouts/application.html.erb %>
<script type="module" src="/jst/jst.js"></script>
```

Do not run JST through `javascript_include_tag` or an importmap that digests
it. The digesting is the whole problem; serving from `public/jst/` sidesteps
it. See [install.md](./install.md#asset-pipelines-and-digested-filenames).

### Where component files go

Pick by which definition strategy you use:

- inline-once - definitions live in the ERB partial that renders the markup, so
  a fragment response ships both. No separate file.
- resolveTemplate - each definition is its own `.html` file the server returns
  on demand. Keep them out of the digest too, for example
  `public/jst/components/app-notice.html`, and point the resolver at that path.
- precompiled - keep the authoring `.html` files anywhere (for example
  `app/jst/`), run the precompile build, and serve the one generated bundle
  from `public/jst/dist/`.

### Render a fragment vs a full page

A full page is an ordinary view with the layout. A fragment is a partial
rendered without the layout, returned to a `fetch`:

```ruby
# app/controllers/orders_controller.rb
def create_item
  @line = @order.add_item(item_params)
  render partial: "orders/line", locals: { line: @line }, layout: false
end
```

```erb
<%# app/views/orders/_line.html.erb %>
<%# inline-once: the row carries its own definition the first time it lands %>
<script type="jst" name="order-line" props="line">
  <li data-line-id="$(line.id)">$(line.title) - $(line.qty)</li>
</script>

<order-line
  .line='<%= { id: @line.id, title: @line.title, qty: @line.qty }.to_json %>'>
</order-line>
```

Pass simple values as attributes and rich values as a JSON property binding, as
above. Remember attribute JSON coercion: `qty="1.0"` arrives as the number `1`,
and an identifier like `id="0123"` loses its leading zero. Pass identifiers and
versions as properties, not attributes. See
[writing-jst.md](./writing-jst.md#3-use-a-component-in-normal-html).

The client fetches and inserts into a trusted root:

```js
const res = await fetch(`/orders/${id}/items`, { method: 'POST', body })
document.getElementById('order-lines').insertAdjacentHTML('beforeend', await res.text())
```

### CSP config

For inline-once or resolveTemplate (in-browser compile):

```ruby
# config/initializers/content_security_policy.rb
Rails.application.config.content_security_policy do |policy|
  policy.script_src :self, :unsafe_eval
end
```

For a precompiled bundle, drop `:unsafe_eval`:

```ruby
policy.script_src :self
```

You cannot have both a strict `:self`-only policy and `resolveTemplate`; the
in-browser compiler needs `unsafe_eval`. Choose the precompiled path if the
policy must stay strict.

## Node / Express

A static-file server plus routes. Serve the JST directory with `express.static`
so relative imports resolve:

```js
import express from 'express'
const app = express()

// Serve the JST module directory verbatim.
app.use('/jst', express.static('vendor/jst'))

// Full page.
app.get('/orders/:id', (req, res) => {
  const order = db.findOrder(req.params.id)
  res.send(`<!doctype html><html><head>
    <script type="module" src="/jst/jst.js"></script>
  </head><body>
    <script type="jst" name="order-line" props="line">
      <li>$(line.title) - $(line.qty)</li>
    </script>
    <div id="order-lines">${renderLines(order)}</div>
  </body></html>`)
})

// Fragment.
app.post('/orders/:id/items', (req, res) => {
  const line = db.addItem(req.params.id, req.body)
  res.type('html').send(renderLine(line))
})
```

For strict CSP without a build, swap the inline definition for a precompiled
bundle and serve it from the same `/jst` mount. For lazy on-demand definitions,
add a `resolveTemplate` resolver and an `unsafe-eval` CSP, and serve each
definition file from `/jst/components/`.

## Any server: the checklist

The pattern reduces to a few rules that hold on any stack.

- Serve the JST module files from one static, non-digested directory - the
  relative imports between them must resolve unchanged.
- Load the entry point once as `<script type="module" src=".../jst.js">` - that
  is the whole client install.
- Return ordinary resourceful HTML for navigation and partials for fragments -
  a fragment is just a partial that may also carry a `<script type="jst">`
  definition.
- Make definitions reachable by exactly one of inline-once, resolveTemplate, or
  a precompiled bundle - mixing resolveTemplate with a strict no-`unsafe-eval`
  CSP does not work.
- Set `script-src` to match - `'self' 'unsafe-eval'` for in-browser compile,
  `'self'` for a precompiled bundle.
- Call `configure()` once per page, in a module script after `jst.js` loads -
  later calls re-merge and rewire the observer.
- Only insert fragments from trusted sources into a trusted root - a JST
  fragment is code. See [security-model.md](./security-model.md).
</content>
</invoke>
