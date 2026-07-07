# Competitors and the JST answer

For every capability the popular component libraries sell, this document gives
the JST answer. The aim is not to reproduce their catalogs. It is to show, for
each thing a user might reach for a rival to do, how you do it in JST, or why it
is not a problem you have to solve in JST's model.

"We have 40 components too" is not the goal. "You do not need 40 components,
here is why" is.

## How JST wins on every front

Not by having the most parts. By needing the fewest. JST wins because it is
simple and minimal and leverages baseline HTML, CSS, and JavaScript, so most of
the field is already covered by the platform before JST adds anything.

That leads to a hard rule for this whole document:

**Where a native HTML, CSS, or JS solution exists, that is the answer. JST does
not wrap it.** A `<dialog>` is the dialog. A `<details>` is the accordion. A
`<button>` is the button. There is no `<jst-dialog>`, and there should not be:
forcing a JST component in front of an element the browser already ships would
make JST larger and the user's page heavier for nothing. Deferring to the
platform is JST winning, not JST missing a feature. JST earns its keep only
where the platform stops: real interaction state, a component boundary, or the
fetch-and-swap data layer.

## The five kinds of answer

Every row below resolves to one of these. All five are legitimate. "Not a
problem in JST" is a real answer, not a missing feature.

- **Platform**: HTML, CSS, or a browser API already does this. In JST you use
  it directly. No component to install.
- **JST component**: JST's component library ships one.
- **Compose in JST**: a short `<script type="jst">` you write in place. JST
  gives the templating, state boundary, and handler helpers; the piece is a few
  lines, not a dependency.
- **jst-nav**: the navigation and data layer covers it. The server sends HTML;
  you do not reshape JSON into client models.
- **Not a problem in JST**: the need exists only because of a build step, a
  client render pipeline, or client-owned state that JST does not use. The
  correct answer to the user is "you do not solve this in JST," and that is a
  selling point, not a gap.

## Simple UI pieces: the platform already has these

Many "components" in framework catalogs are a thin wrapper over an element the
browser ships. In JST you use the element. That is the whole recipe.

| They sell a component for | In JST | Kind |
| --- | --- | --- |
| Button | `<button>` with an `onclick` body, styled by `jst-components.css` | Platform |
| Modal / Dialog | `<dialog>` + `el.showModal()` / `el.close()` | Platform |
| Accordion / Disclosure | `<details><summary>` | Platform |
| Dropdown menu / Popover | Popover API: `popover` attribute + `popovertarget` | Platform |
| Tooltip | `title`, or the Popover API for rich content | Platform |
| Select | `<select>` (use jst-combobox when you need search) | Platform |
| Checkbox / Radio / Switch | `<input type=checkbox\|radio>`, switch is a styled checkbox | Platform |
| Slider / Range | `<input type=range>` | Platform |
| Progress / Meter | `<progress>` / `<meter>` | Platform |
| Date / Time / Color picker | `<input type=date\|time\|color>` | Platform |
| Badge / Card / Avatar / Alert | Markup plus a class from `jst-components.css` | Platform |

The JST talking point for this whole block: a design system that needs a React
component for a button is solving a problem JST does not have. You get the
element, you style it once, you move on.

## Stateful widgets: JST components, or compose one

The pieces with real interaction state and accessibility logic. JST ships the
hard ones and lets you author the rest inline.

| Capability | In JST | Kind |
| --- | --- | --- |
| Combobox / Autocomplete | `<jst-combobox options='[...]'>` | JST component |
| Command palette | `<jst-palette>`, drive `palette.actions = [...]`, open on `Meta+k`, listen for the `run` event | JST component |
| Data table (sortable) | `<jst-table columns='[...]' rows='[...]'>` | JST component |
| Tabs (roving tabindex, arrow keys) | `<jst-tabs active="0" tabs='[...]'>` | JST component |
| Toast / Notifications | `<jst-toaster>`, fed by a `--toast` command or `toaster.push(msg, variant)` | JST component |
| Stepper, tags input, rating, segmented control, and similar small stateful widgets | A `<script type="jst" name="...">` in a few lines: attributes in, `el.emit` out, `$ if` / `$ forEach` for the view | Compose in JST |

Composing one is the point of JST, so it is worth showing the shape once:

```html
<script type="jst" name="star-rating" attributes="value max">
  $ const stars = Array.from({ length: max || 5 }, (_, i) => i + 1)
  <div role="radiogroup">
    $ forEach(stars, (n) => {
      <button type="button" aria-checked="$(n === value)"
              onclick="el.value = $(n); el.emit('change', { value: $(n) })">
        $(n <= value ? '★' : '☆')
      </button>
    })
  </div>
</script>

<star-rating value="3"></star-rating>
```

Attributes down, an event up, no build, a real custom element. That is the
answer to "but library X has a `<Rating>`."

## Data, lists, and forms: jst-nav, not a data-fetching library

This is the block where the React ecosystem sells the most add-ons (data
fetching, caching, table pagination, infinite scroll, optimistic updates,
form libraries). In JST the server owns the data and sends HTML, so jst-nav
covers the category and the extra libraries are not part of the picture.

| Capability | In JST | Kind |
| --- | --- | --- |
| Async data loading | `<jst-include src="/panel">`, or a link with `jst-target` | jst-nav |
| Paginated / filtered lists | Links and forms with `jst-target` + `jst-swap`; the server renders the page | jst-nav |
| Live / debounced search | `oninput="if (changed(event)) debounce(event, 300, () => swap('#results', '/search?q=' + this.value))"` | jst-nav |
| Infinite scroll | `onreveal` on a sentinel + `jst-swap="beforeend"` | jst-nav |
| Form submit + server validation | Native `<form>` + `jst-swap-4xx="outerHTML"` so the form re-renders itself with errors | jst-nav |
| Optimistic UI / cancel a stale response | `jst:before-swap` (cancelable), per-element request abort | jst-nav |
| State-preserving updates | `jst-swap="morph"` (with `jst-select` for whole regions), `jst-key` for lists | jst-nav |
| Data fetching + caching (React Query / SWR) | Not a problem in JST: the server is the cache boundary; responses are HTML, not JSON to normalize | Not a problem |

## Data visualization

| Capability | In JST | Kind |
| --- | --- | --- |
| Charts (line, bar, area, sparkline) | Server-rendered SVG swapped in with jst-nav, or a focused chart library dropped in as a custom element. A charting engine is not JST's job and does not need to be | Compose in JST / Platform |

Decided: JST adds no special charting support. SVG and small single-purpose
chart libraries already exist as drop-in elements and slot into the
custom-element model on their own. Owning a charting engine would break the
minimalism rule for no gain, so this stays a "use a third-party element" answer
by design.

## Styling and theming

| They sell | In JST | Kind |
| --- | --- | --- |
| Utility CSS (Tailwind) | Not a problem in JST: components ship their own styling; use any CSS you like alongside | Not a problem |
| Component CSS (daisyUI, Bootstrap, Bulma) | `jst-components.css` + `jst-layout.css` | JST component |
| Design tokens (Open Props) | CSS custom properties; components read them, so theming is a variable swap | Platform |
| CSS-in-JS | Not a problem in JST: there is no JS build to put CSS into | Not a problem |

## Things that are only problems because of the other model

The category the "no excuse not to use JST" argument leans on hardest. These
are not gaps. They are needs that a build step and a client render pipeline
create, and that JST's model removes.

| They ship | Why it exists there | The JST answer |
| --- | --- | --- |
| Client router / SPA navigation | The client owns rendering, so it must own routing | Not a problem: navigation is real URLs and server responses, with jst-nav swaps and history |
| Global state manager (Redux, Zustand) | Client-owned state has to live somewhere | Not a problem: state lives in the page, the parent, or the server; attributes down, events up |
| Virtual DOM / reconciler | Diffing a client-rendered tree | Not a problem: `morph` reconciles real DOM, preserving identity, focus, and scroll |
| Hydration | Reconciling server HTML with a client bundle | Not a problem: there is no separate client bundle to hydrate |
| Headless behavior primitives (Radix, Zag) | Give framework code the logic without the styling | Open question, not a gap: JST fuses behavior into elements today. Whether to also expose logic-only primitives is a design choice to make deliberately, not a box to tick |

## What JST brings that the catalogs above do not

The other side of every comparison, for completeness:

- No build step, including for authoring your own components.
- Real custom elements: inspectable, scriptable, usable in any framework or
  none.
- A navigation and data layer built in (fetch, swap, morph, history, forms,
  CSRF). Almost none of the component libraries ship this; their users add
  htmx or Turbo separately.
- Hypertext as the API: one response can carry component definitions and the
  markup that uses them.
- A small footprint: 11.5 KB gzipped runtime plus compiler, 7 KB runtime-only.

## Reading this as a to-do list

Most rows are already answered by the platform, an existing JST component,
jst-nav, or the model itself. The short list of things worth a deliberate
decision (build, adopt, or write down as out of scope) rather than an
assumption:

1. Whether the component library should grow a few more authored widgets
   (stepper, tags input, and the like) as ready-made `<script type="jst">`
   snippets, or leave them as documented compose-it-yourself recipes.
2. A first-class theming and design-token page, so the "swap a variable"
   answer above is demonstrated rather than asserted. Committed: the
   themeability claim gets proven, not stated.
3. A stated position on headless primitives (fuse into elements, or expose
   logic-only). Charts are settled: drop-in third-party elements, no special
   JST support (see Data visualization above).

Everything else on this page is already "here is how you do it in JST," and for
a real share of the field the answer is the strongest one: it is not a problem
you have in JST.
