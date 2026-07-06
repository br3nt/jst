# Design: component library + the directive seam

Status: **Layers 0 and 1 built** (`jst-layout.css`, all twelve primitives); Layer 2
components not started. Tracks issue [#8](https://github.com/br3nt/jst/issues/8)
(layout primitives) and informs [#7](https://github.com/br3nt/jst/issues/7) /
[#3](https://github.com/br3nt/jst/issues/3) (directives) and [#28](https://github.com/br3nt/jst/issues/28)
(datasource).

## Goal

An **opt-in** component library that makes adopting JST easy, built CSS-first in
the spirit of [Every Layout](https://every-layout.dev) and the
[CSS Zen Garden](https://csszengarden.com) bet: structure stays put, the whole
look re-themes by overriding CSS custom properties. The opposite of a utility
library like Tailwind - we lean on modern CSS and HTML *first*, and only add a
component when it genuinely beats raw HTML + CSS.

Same packaging principle as the runtime-only builds: **core stays tiny,
everything here is opt-in.**

## Why co-design layout and directives together

Layout primitives are pure CSS with zero behavior. But building real components
(dropdown, modal, collapsible sidebar) you hit the same handful of *behaviors*
over and over - open/close, outside-click, escape-to-close, enter/leave
transition, fetch-and-swap. If each component re-implements them, the library
bloats and drifts. Designed together, those behaviors factor out into a few
**directives** the components compose. That is the simplification, and it maps
cleanly onto two mental models JST users already have: client behaviors
(Alpine-shaped) and server-driven nav (HTMX-shaped).

## Package map

```
jst.js          core: compile <script type="jst"> → custom elements + morph
jst-layout      CSS base + design tokens + layout primitives + components   (runtime-OPTIONAL)
jst-behaviors   <jst-include> / jst-teleport: client components the platform lacks
jst-nav         boost / target / swap / push-url / select + error handling   (server, HTMX-shaped, #3)
```

Dependency direction: `jst-layout` may use `jst-behaviors`; both depend only on
the platform + core. `jst-nav` is independent. **Finding for #7:** the directives
are *two* modules, not one - the component library depends on the behaviors tier
but not on nav, so they should be separately includable.

## Layering inside `jst-layout`

### Layer 0 - Base (classless, Pico/Zen-Garden style)

A reset + element styling driven entirely by CSS custom properties. The
deliverable is a **theming contract**: a documented `--jst-*` token set the user
overrides at `:root`, and everything re-themes.

One **modular space scale** (one ratio → derived steps), a **measure** (line
length), **radius**, **border**, a **font scale**, and **color roles**. Dark mode
falls out of `light-dark()` for free.

Modern CSS we lean on, each tagged with its [Baseline](https://web.dev/baseline)
status and a fallback so we degrade gracefully (drop the fallback once the
feature is Baseline-wide):

| Feature | Used for | Baseline | Fallback |
| --- | --- | --- | --- |
| `light-dark()` | auto light/dark token values | Baseline 2024 | explicit `@media (prefers-color-scheme)` |
| Relative color syntax `oklch(from … )` | derive a shade ramp from one accent token | Baseline 2024 | hand-authored shade tokens |
| `contrast-color()` | auto-pick accessible foreground on a color | **not** Baseline (limited) | static `--jst-accent-fg` default, upgraded under `@supports` |
| `oklch()` | perceptually-even color + shades | Baseline 2023 | `hsl()` |
| Container queries | component-level responsiveness | Baseline 2023 | media queries |

> **Gotcha (verified in the prototype):** relative-color shade tokens declared at
> `:root` - `--jst-accent-600: oklch(from var(--jst-accent) …)` - are computed
> once **at `:root` scope** and inherit as that absolute color. Overriding
> `--jst-accent` in a *descendant* subtree does **not** re-derive them, so the
> base accent re-themes but the ramp stays frozen. **Global theming** (override at
> `:root`) works as expected. For **subtree/per-component theming**, derive the
> shade at use-site instead - `background: oklch(from var(--jst-accent) calc(l - 0.08) c h)`
> in the actual property - or redeclare the ramp in that scope. `jst-layout.css`
> takes the use-site approach for button hover for this reason.

The shade payoff: define **one** accent, derive the ramp.

```css
:root {
  --jst-accent: oklch(0.55 0.18 250);
  --jst-accent-600: oklch(from var(--jst-accent) calc(l - 0.08) c h);
  --jst-accent-700: oklch(from var(--jst-accent) calc(l - 0.16) c h);
  --jst-accent-fg: white;                 /* fallback */
}
@supports (color: contrast-color(red)) {
  :root { --jst-accent-fg: contrast-color(var(--jst-accent)); }
}
```

### Layer 1 - Layout primitives (Every Layout, as CSS-only custom elements)

Each primitive is a `<jst-*>` element styled purely with CSS - **no JavaScript
required**, because an unknown element is still a valid CSS selector. Per-instance
values come from an inline custom property (no JS) or, with the optional sugar
loaded, from a reflected attribute.

```html
<!-- no runtime: set the var inline -->
<jst-stack style="--space: var(--jst-space-l)"> … </jst-stack>

<!-- with jst-layout's optional JS sugar: attribute reflects to --space -->
<jst-stack gap="l"> … </jst-stack>
```

| Element | Vars | Job |
| --- | --- | --- |
| `<jst-stack>` | `--space` | vertical rhythm between children |
| `<jst-cluster>` | `--space --justify --align` | wrapping inline group (tags, button rows) |
| `<jst-grid>` | `--min --space` | intrinsic `auto-fit minmax` grid |
| `<jst-sidebar>` | `--side --side-width --content-min --space` | sidebar + content, no breakpoint |
| `<jst-center>` | `--measure --gutters` | centered measure |
| `<jst-switcher>` | `--threshold --space --limit` | N-up that flips to stacked |
| `<jst-cover>` `<jst-frame>` `<jst-reel>` `<jst-box>` `<jst-imposter>` `<jst-icon>` | … | hero / aspect-ratio / scroller / padded box / overlay / inline icon |
| `<jst-field>` | (none) | one labelled control: label + control + optional `<small>` hint/error |
| `<jst-form-row>` | `--space --field-min` | single-line form: fields share the row and wrap, buttons keep natural size |

**Naming:** `<jst-*>` prefix (matches `window.JST`), hyphen-valid (required for
custom elements), collision-safe (unlike a bare `.stack` class), groups in
autocomplete. No `-l` suffix.

### Layer 2 - Components, run through the filter

The rule, applied per component: **does this beat raw HTML + CSS?** If the
platform already does it, we ship nothing (or thin CSS), and the docs *say so*.

- **Just use HTML + CSS - ship nothing / thin CSS:**
  - modal → `<dialog>` + `showModal()`
  - accordion / disclosure → `<details>` / `<summary>`
  - tooltip / menu → Popover API + CSS anchor positioning
  - progress → `<progress>`
- **Genuinely needs a component (behavior + a11y):** tabs, combobox /
  autocomplete, toast stack, sortable data table, command palette. Borrow the
  *behavioral spec* (keyboard / focus / ARIA) from Radix / React Aria - not their
  code.

This list **shrinks as the platform advances.** Track against Baseline; when a
component's job becomes expressible in plain HTML + CSS, demote it to a "just use
HTML + CSS" note.

## The platform did most of our work: Invoker Commands + popovers (#29)

The original plan was a `jst-behaviors` tier of Alpine-shaped directives for
open/close, dismiss, outside-click, escape. The **Invoker Commands API**
(`command`/`commandfor` on `<button>`, [Baseline Newly available 2025](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API))
plus the **Popover API** and `<dialog>` now cover almost all of it natively, with
zero JavaScript. The `jst-behaviors` tier nearly evaporates.

| Behavior we were going to build | Native replacement |
| --- | --- |
| toggle / disclosure | `command="toggle-popover"` + `[popover]`, or `<details>`/`<summary>` |
| dismiss nearest | `command="close"` / `request-close` on `<dialog>` |
| show / hide + transition | popover/dialog + `@starting-style` + `transition-behavior: allow-discrete` |
| outside-click / escape | **built in** to the Popover API (light-dismiss) |

What the platform does *not* give us, so it stays in scope:

| Still needs JS / a directive | Home |
| --- | --- |
| reveal / lazy on scroll (IntersectionObserver) | synthetic `onreveal` event (core) + `<jst-include when="visible">` (`jst-behaviors`) |
| custom-command routing sugar | a tiny helper, not a module (below) |
| fetch + swap + history | `jst-nav` (#3) - see verbs below |

### Custom commands ride JST's existing `on*` binding

A custom command (`command="--foo"`) dispatches a `CommandEvent` named `command`
on its target. JST already attaches *any* `on<event>` function body via
`addEventListener` (`interpreter.js`), so `oncommand="…"` works with **no new
compiler path**. The handler gets `event.command` (`"--foo"`) and `event.source`
(the button).

> **Verified finding - `CommandEvent` does not bubble.** It is dispatched
> `bubbles: false, composed: false`, so it fires *only* on the exact `commandfor`
> target - a parent component cannot catch a child's custom command by bubbling.
> For "events up to a parent," the target handles `oncommand` and then re-emits
> via JST's own `el.emit(name, detail)` (which *is* `bubbles: true, composed:
> true`). This keeps the existing attributes-down / events-up mental model intact.

The command **router** (so a target handling several `--commands` doesn't need
a hand-written `switch`) is the `commands(event, map)` handler helper, shaped
like `keys(event, map)`:

```html
<my-thing oncommand="commands(event, { '--save': save, '--revert': revert })">
```

It lives with the other handler helpers (in scope in template handler bodies;
`JST.fn.commands` elsewhere). `examples/invoker_commands.html` uses it for the
host-level command listener.

## Commands and ids: no synthetic id system

`commandfor` (and `popovertarget`) resolve **by `id` only** - the API has no
relative/scoped form. JST is light DOM, so an `id` hard-coded in a template
collides when the component is instantiated more than once (issue #12). The
resolution is **not** a parallel/auto id system. It is:

- **Templates carry no ids.** They are templates.
- **Ids come from the author at the usage site** - `<my-dialog id="signup">` - like
  any HTML id, and the author keeps them unique like any HTML id.
- **Component internals use scoped `el.querySelector` + the imperative API**
  (`el.querySelector('.panel').togglePopover()`), so they need no id at all.

| Case | Wiring | Ids |
| --- | --- | --- |
| dialog/popover in **usage HTML** | native `command`/`commandfor` | author writes the id |
| **inside** a component (self-contained widget) | `el.querySelector(...)` + `.showModal()`/`.togglePopover()` | **none** - scoped by `el` |
| custom command **to** a component | `command="--x" commandfor="report1"`, component listens on itself | author gives the *instance* an id |

> **Verified (see `examples/invoker_commands.html`):** built-in commands, scoped
> internal toggles, and custom `--commands` were each instantiated multiple times
> in Chrome. Built-in commands target the right instance; internal toggles are
> instance-correct with **zero ids** (`querySelectorAll('[id]')` inside the
> components returns `[]`); custom commands route to the author-id'd instance; and
> `command`/`commandfor` survive the morph re-render (#29 item 3).
>
> The one place a derived per-instance id is still sometimes unavoidable is
> **accessibility association** (`<label for>`, `aria-describedby`), which the
> browser resolves only by id and which has no `querySelector` substitute - see
> `writing-jst.md` §14. That is "author derives an id when a11y forces one," not a
> framework id namespace.

### When a template *does* use `command`/`commandfor`

A template is a template, not an instance, so it can't invent an id. When a
template legitimately needs one, **the id arrives as a template attribute** (what
we currently call an attribute) and is interpolated. Three shapes, strongest first:

**1. A reusable trigger pointing at an external target (best - no internal id).**
The id is a *reference* to something the author owns elsewhere; the template holds
no id of its own.

```html
<script type="jst" name="open-button" attributes="for label">
  <button command="show-modal" commandfor="$(for)">$(label)</button>
</script>

<open-button for="signup" label="Join"></open-button>
<dialog id="signup">…</dialog>
```

**2. A self-contained widget that wants native a11y + zero JS (id passed in, used
twice).** The author supplies a unique id per instance; the template interpolates
it into *both* `commandfor` and the internal `id`. The payoff over a scoped
`onclick` is that the Invoker/Popover wiring sets the invoker's ARIA state
(`aria-expanded`, `aria-details`) automatically.

```html
<script type="jst" name="info-popover" attributes="id label">
  <button command="toggle-popover" commandfor="$(id)">$(label)</button>
  <div id="$(id)" popover>…</div>
</script>

<info-popover id="tip-shipping" label="?"></info-popover>   <!-- author keeps ids unique -->
```

**3. Simple internal toggle, no id wanted → scoped `el.querySelector`.** Use this
when ARIA isn't load-bearing and you'd rather not require an id attribute.

Rule of thumb: **external target → `commandfor` with a passed-in id (case 1);
internal target where native ARIA matters → id-as-attribute used twice (case 2);
otherwise scoped query (case 3).** The id is always author-owned, never minted.

## What remains of the directive seam

| Behavior | Mechanism | Tier |
| --- | --- | --- |
| open / close / toggle / dismiss | native `command`/`commandfor` + `<dialog>`/popover | platform |
| outside-click / escape | native popover light-dismiss | platform |
| custom action → component | `oncommand` + the router helper | core helper |
| reveal / lazy on scroll | `jst-intersect` | `jst-behaviors` (client) |
| enter/leave transition (conditional) | `jst-transition` on keyed nodes | core |
| fetch + swap + history + verbs | `jst-boost` / native `href`/`action`/`method` / `jst-target` / `jst-swap` / `swap()` | `jst-nav` (server, #3) |

## `jst-nav` and HTTP verbs: reuse native `method` (shipped in v0.6.0)

HTMX's headline is *any element fires any verb* (`hx-get/post/put/patch/delete`).
The shipped answer reuses the platform's own spelling rather than inventing
`jst-method` or five per-verb attributes:

- A form already carries `action` + `method`; jst-nav reads them, and the swap
  layer honors `method="put|patch|delete"` (which the browser would otherwise
  normalize to GET). `method` is honored on enhanced links too.
- There is no `jst-action`: jst-nav only enhances elements that already act
  (links and forms). A plain button firing a verb is a handler calling
  `swap(target, url, { method: 'DELETE' })`.

```html
<form action="/items/8" method="delete" jst-target="closest .item">…</form>
<button onclick="swap(this.closest('.item'), '/items/8', { method: 'DELETE', swap: 'outerHTML' })">Delete</button>
```

This keeps the surface tiny (the fixi note on #3: "resist an htmx-sized surface")
and lets JST *enhance* native attributes instead of shadowing them.

## Targeting is 100% CSS selectors

HTMX's `hx-target` mixes CSS with a bespoke micro-DSL (`closest`, `next`,
`previous`, `this`, `find`). **JST targeting must be expressible entirely as
standard CSS selectors**, resolved through the platform's own selector engine
(`querySelector`, `closest`, `matches`, `:scope`):

- descend into a subtree → `jst-target=":scope .results"` (resolved from the
  element)
- nearest ancestor → `jst-target="closest .item"` - `closest()` takes a **CSS
  selector**, so this stays pure CSS, not an invented keyword
- document-wide → any selector: `#mainview`, `.panel[data-active]`

No `next`/`previous`/`this` keywords. If a relationship can't be written as a CSS
selector, we don't add a keyword for it - we reconsider the markup.

## Gap analysis: HTMX & Alpine minus the platform, CSS, and JST

JST's thesis is "take the gaps HTMX/Alpine fill, then remove whatever the
platform, CSS, or JST already does." Subtracting those, here is what is actually
left to build - and where each lands.

### Alpine.js

| Alpine | Subtract because… | Left for JST |
| --- | --- | --- |
| `x-data`, `x-init` | JST components own state (`el.*`) + render | - already JST |
| `x-show` / `x-if` / `x-bind` / `x-text` | JST `$(…)` interpolation + `$ if`/`$ for` | - already JST |
| `x-on` (`@click`) | JST `on*` bindings | - already JST |
| `x-model` | two-way bind | `jst-model` - already JST |
| `x-transition` | conditional enter/leave | `jst-transition` - already JST |
| `x-show` toggle + `@click.outside` | popover light-dismiss / `command`; `.outside` registration modifier | platform / already JST |
| `x-ref` | `el.querySelector` (scoped) | - already JST |
| `x-intersect` | IntersectionObserver | synthetic `onreveal` + `<jst-include when="visible">` - already JST |
| `x-cloak` | FOUC hide before hydrate | `:not(:defined) { display: none }` - platform (better: zero JS) |
| `x-teleport` | move node elsewhere | `jst-teleport` (jst-behaviors); popover/`<dialog>` top-layer covers most |

### HTMX

| HTMX | Subtract because… | Left for JST |
| --- | --- | --- |
| `hx-get` / `hx-boost` | GET fetch + swap | `jst-boost` / #3 ✅ |
| `hx-post/put/patch/delete` | verbs on any element | native `method` on links/forms; other causes call `swap(url, { method })` (above) |
| `hx-target` | where it lands | `jst-target` - **CSS selectors only** (above) |
| `hx-swap` (incl. `morph`) | how it lands | `jst-swap`; JST already morphs |
| `hx-select` | pick a subtree from a response | `jst-select` / #3 |
| `hx-push-url` / history | back/forward, restore | `jst-push-url` / #3 |
| `hx-trigger` (events, modifiers, `from:`) | when it fires | plain `on*` handlers + the handler helpers; `from:` = addEventListener + `swap()` (v0.6.0) |
| `hx-trigger="revealed"` | scroll-in | synthetic `onreveal` event / `<jst-include when="visible">` |
| `hx-swap-oob` | out-of-band updates | `jst-swap-oob` in jst-nav responses |
| `hx-indicator` | loading state | the `jst-request` class during a fetch + CSS; → #28 for data |
| `hx-confirm` | confirm before send | `jst-confirm` |
| `hx-on` | inline handlers | JST `on*` |
| `hx-disable`/`hx-disinherit` | scope control | `jst-boost="false"` opt-out (#3) |
| SSE / WebSocket extensions | streaming | out of scope (extension) - relates to #28 |

The gaps this pass originally surfaced (two-way input sugar, an `x-cloak` FOUC
convention, out-of-band swaps, trigger/`from:` event sourcing) have since landed
as `jst-model`, native `:not(:defined)` cloaking, `jst-swap-oob`, and the v0.6.0
cause model (handlers + `swap()`). Everything else is either already JST,
already the platform, or tracked in #3/#28/#29.

## Docs convention

Every component page starts with a **"Do you even need this? - just use HTML +
CSS"** callout and a runnable example, *then* the JST component if one is still
justified. Each modern-CSS feature is tagged with its Baseline status and a
fallback. The message throughout: **reach for the platform first.**

## Open questions

- Attribute→var reflection: ship the JS sugar, or document inline `--var` only
  for the foundation and add sugar later?
- Do `<jst-grid>` / `<jst-switcher>` move to container queries now (Baseline) or
  keep the intrinsic flex/grid recipes?
- Where does the line sit between `jst-layout` shipping a component vs. pointing
  at a `jst-behaviors` directive + plain markup?

## Current state

Layer 0 (tokens + classless base) and all twelve Layer 1 primitives are in
`jst-layout.css`: stack, cluster, grid, sidebar, center, box, switcher, cover,
frame, reel, imposter, icon. `examples/layout_primitives.html` demonstrates each
one plus the one-token re-theme, with zero JavaScript on the page. Next: settle
the open questions above, then run Layer 2 candidates (tabs, toast, combobox)
through the "does this beat raw HTML + CSS?" filter.
