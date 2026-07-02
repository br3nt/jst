# Security model

This page explains JST's trust boundary in practice. The canonical statement is
in the root [SECURITY.md](../SECURITY.md); read that too.

## The trust boundary

JST treats three things as different trust levels:

1. Data interpolated with `$(expr)` is escaped. Safe to render untrusted values.
2. `trustedHTML()` is trusted HTML you vouch for. Never pass untrusted input.
3. Fetched JST template fragments are executable application code. Only load
   same-origin, trusted fragments.

Get those three right and you have the model. The rest of this page is detail.

## Context escaping: what `$()` does and does not cover

`$(expr)` HTML-escapes its value: `&`, `<`, `>`, `"`, `'` become entities. That
makes it safe in two contexts:

- HTML text content: `<p>$(comment)</p>`
- Quoted attribute values: `<div title="$(label)">`

It is NOT safe in every context. HTML-escaping does not neutralise dangerous
URL schemes, and it is not CSS-context or JS-context escaping.

### URL context: use `url()`

Escaping `javascript:alert(1)` leaves it intact, because none of those
characters are HTML-special. So this is a hole:

```html
<!-- UNSAFE if userLink is attacker-controlled -->
<a href="$(userLink)">go</a>
```

Use `url()`, which blocks `javascript:`, `data:`, `vbscript:` and other
non-allowed schemes (it allows http, https, mailto, tel, ftp) and returns `#`
otherwise:

```html
<a href="$(url(userLink))">go</a>
<img src="$(url(userImage))">
```

### CSS and JS contexts

Do not interpolate untrusted data into inline `style` containing expressions, or
into inline event-handler attributes, or into `<script>` bodies. `$()` does not
escape for those contexts. Use JST's `on<event>` bindings (which attach real
listeners, no string-to-code) and bind discrete style properties rather than
splicing untrusted strings into CSS.

## `trustedHTML()` is trusted HTML

`trustedHTML(value)` inserts its argument as HTML with no escaping. It exists for
HTML you produce or sanitise yourself. Passing untrusted input to
`trustedHTML()` is an XSS bug. If you must render user HTML, sanitise it first
with a real sanitiser, then pass the sanitized result to `trustedHTML()`.

`trustedHTML()` is the only helper that opts out of escaping; it states the
contract clearly: the value is HTML you have already produced or sanitised.

## Fetched templates are application code

When a fragment arrives in the DOM and contains a `<script type="jst">`, JST
auto-registers it as a real custom element. And `config.resolveTemplate(tag)`
can fetch a component's definition the first time an unknown tag appears. Both
mean: an HTML fragment can introduce executable component code into your page.

Therefore, only resolve and insert same-origin, trusted fragments. A fragment
from an untrusted origin is equivalent to letting that origin run code in your
page. If you do not want auto-pickup of fetched templates, set
`autoRegister: false` (see [hateoas-fragments.md](./hateoas-fragments.md)).

## Name collisions: prefix your components

Custom element names are global. If two definitions claim the same tag, the
first wins and JST warns about the duplicate. To avoid collisions with
third-party fragments or vendored components, use an app or vendor prefix:
`acme-todo-item` rather than `todo-item`.

## CSP and `new Function`

The browser compiler builds render functions with `new Function`, which CSP
treats as eval. A strict policy needs `'unsafe-eval'` unless you use the
precompile mode. See [production.md](./production.md).

JST's `on<event>` handlers do not change that CSP story. They live inside
`<script type="jst">`, which the browser treats as inert text, and JST compiles
them into `addEventListener` calls. They are not literal DOM `onclick`
attributes, so they do not require `'unsafe-inline'`, a nonce, or a hash. The
only CSP lever JST needs in runtime-compilation mode is `'unsafe-eval'` for
`new Function`; `tools/precompile.mjs` removes that requirement by compiling the
templates before they reach the browser.

## Reporting

Found a security issue? See the reporting line in the root
[SECURITY.md](../SECURITY.md).
