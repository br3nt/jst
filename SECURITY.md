# Security Model

JST has two separate trust boundaries.

## Escaped Interpolation

`$(expr)` is escaped by default. Values are converted to text and cannot create
HTML nodes, attributes, or scripts.

Use `trustedHTML(value)` only for trusted HTML that your application
intentionally wants to insert. Treat it like `innerHTML`.

HTML escaping does not make every attribute safe. For URL-bearing attributes,
use `url(value)`:

```html
<a href="$(url(userLink))">Open</a>
```

`url()` allows relative URLs and common safe schemes such as `http`, `https`,
`mailto`, `tel`, and `ftp`. Other schemes are replaced with `#`.

## Template Execution

`<script type="jst">` templates contain JavaScript. Registering a template is
code execution. Do not auto-register templates fetched from untrusted users,
public comments, CMS content, or third-party origins.

Safe patterns:

- Serve templates from your own origin.
- Gate lazy template loading with `JST.configure({ resolveTemplate })`.
- Prefix application components, for example `app-card`, and reject unknown names.
- Use `autoRegisterRoot` to scope automatic registration to a trusted container.
- Set `autoRegister: false` when inserting untrusted HTML into the page.

```js
JST.configure({
  autoRegisterRoot: document.getElementById('trusted-fragments'),
  resolveTemplate(name) {
    if (!name.startsWith('app-')) return null;
    return `/components/${name}.html`;
  },
});
```

## CSP

Runtime template compilation uses `new Function`, so runtime mode requires a CSP
that permits `unsafe-eval`.

For strict CSP, precompile templates:

```sh
node tools/precompile.mjs components.html --out dist/templates.js --runtime ../jst.js
```

Then load `jst.js` and the generated module instead of shipping raw
`<script type="jst">` blocks. Precompiled modules register render functions
directly and do not need runtime `new Function`.

## Reporting

If you find a security issue, open a private disclosure channel with the project
owner rather than filing a public exploit report.
