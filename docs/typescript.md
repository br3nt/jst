# TypeScript

JST ships hand-written TypeScript declarations. There is still no build step:
use TypeScript to check your page JavaScript and editor hints, not to transpile
JST templates.

## Install-time types

Package consumers get the root declarations automatically:

```ts
import { configure, trustedHTML, url, type JSTComponentElement } from '@br3nt/jst';
import { configure as configureNav } from '@br3nt/jst/nav';
import { configure as configureBehaviors } from '@br3nt/jst/behaviors';
```

The declarations cover the public runtime API:

- `configure()`, `trustedHTML()`, `url()`
- `slot()`, `once()`, and `onDisconnect()` as template helper types
- `el.emit()` through `JSTElement` / `JSTComponentElement`
- the `window.JST` global, including `JST.nav.csrf`, `JST.nav.configure`, and
  `JST.behaviors.configure`

## Typecheck JavaScript without transpiling

For a no-build app, keep authoring browser JavaScript and ask TypeScript to
check it:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "module": "nodenext",
    "target": "es2022",
    "lib": ["dom", "es2022"]
  },
  "include": ["public/**/*.js", "public/**/*.html"]
}
```

In plain `.js`, use JSDoc where you want typed component properties:

```js
/** @type {import('@br3nt/jst').JSTComponentElement<{ count: number }>} */
const counter = document.querySelector('hello-counter');

counter.count = 1;
counter.addEventListener('change', event => {
  console.log(event.detail);
});
```

For global-build pages, add a small project reference file so the global is
known to TypeScript:

```js
/// <reference types="@br3nt/jst" />

window.JST?.configure({ dev: true });
window.JST.nav?.csrf.headerName = 'X-CSRFToken';
```

## Boundary

The shipped types describe the runtime API and declared attribute/property
boundary. TypeScript does not parse expressions inside `<script type="jst">`
templates yet, so `$(...)`, `$ if`, `.prop="$(...)"`, and `on<event>="$(...)"`
expressions are not typechecked inside HTML files. That requires a future
language-service plugin that understands JST template ranges.
