# Coming from other frameworks

JST deliberately leaves out several concepts other frameworks ship. None of them
are missing by accident — each is a consequence of JST's core bet:
**components expose a well-defined interface (attributes in, events/commands
out), the server is authoritative, and a component re-renders by morphing its own
light DOM.** Here's the thing you reach for elsewhere, and what you do instead.

| You might look for… | (e.g.) | In JST you… |
| --- | --- | --- |
| **A shared/reactive store** | Alpine `$store`, Redux | Pass state in as **attributes** from a page-level owner, or let the **server** hold it. Data flows down a visible path. |
| **Context / dependency injection** | React `useContext`, Vue `provide`/`inject`, `@lit/context` | Pass it in as **attributes**. If a tree is deep, fix the *composition* or pass one structured object — don't hide the flow behind a context. The interface is the contract. |
| **A refs registry** | Alpine `$refs`, `ref()`, Vue template refs | `el.querySelector('.thing')` after render. Light DOM needs no registry. |
| **Two-way binding on a component** | Vue `v-model` on a child component | Explicit: `.attr="$(value)"` down, an event up. Ownership stays visible. (`jst-model` is **only** for native form inputs, which genuinely own their own draft.) |
| **A computed / memo** | Vue `computed`, `useMemo` | Derive **cheaply inline** with `$ const`. Anything expensive is *business logic* — it doesn't belong in a template: pass the derived value in as an attribute (server- or parent-computed), or compute it in the component's setup. JST re-renders the small component on attribute change; it has no per-value dependency graph, by design. |
| **An effect / watcher** | `useEffect`, `x-effect`, `$watch` | The render body **is** the effect (it re-runs on attribute change); the mutating handler **is** the watcher. For run-once-after-mount, use `once()`. |
| **An "ignore this region" directive** | htmx `hx-preserve`, fixi `fx-ignore`, Alpine `x-ignore` | Wrap the third-party widget in a **component** and project its DOM through a **slot** (`$(slot())`). Projected nodes are *moved*, not re-rendered, so the host's morph never touches them. The component exposes a query/command **interface** over the widget; the widget's DOM-state lives behind it. (This is why JST ships no `jst-ignore` — slots already do it.) |
| **List / transition animations** | Vue `<TransitionGroup>` (FLIP), Svelte transitions | The browser's **View Transition API**. Put `view-transition` on a component *instance* to animate its re-renders (`<my-list view-transition>`), or `jst-swap="transition"` on a `jst-nav` swap. You describe the old/new look in `::view-transition-*` CSS; the browser computes the FLIP. Per-instance, the consumer's choice — see `examples/view_transition_component.html`. |
| **Scoped styles** | Lit `static styles = css\`…\`` | Plain global CSS. JST is light DOM on purpose, so your component composes with the page's styles instead of hiding behind a shadow boundary. |

The throughline: **the component interface is the contract.** It says how state is
queried (attributes/properties) and commanded (methods, emitted events, custom
`--commands`). Most components stay stateless; when something genuinely owns state
in the DOM (a chart, a map, an editor), you encapsulate it behind that interface
rather than letting the rest of the app reach into it.
