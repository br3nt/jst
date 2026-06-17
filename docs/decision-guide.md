# Decision Guide

## Use JST When

- You want the backend and frontend to share the same UI representation: HTML.
- Your app is naturally HATEOAS-shaped: links, forms, fragments, server-owned
  state, and progressive updates.
- You want interactive components without a build step.
- You want custom elements that can be inspected and controlled with plain DOM APIs.
- You are building small-to-medium product surfaces, dashboards, internal tools,
  demos, embedded widgets, or static sites with pockets of interaction.

## Avoid JST When

- You need untrusted users to author templates.
- Your production CSP cannot allow `unsafe-eval` and you are not willing to use
  precompiled templates.
- You need a full application framework: router, data cache, suspense, server
  rendering pipeline, scoped styles, or a mature ecosystem of components.
- You need fine-grained reactivity for very large client-owned state graphs.
- Your team wants TypeScript-first component authoring today.

## Production Path

1. Start with runtime mode while the component API is changing.
2. Keep components controlled: data down via attributes/properties, events up.
3. Prefix app components, for example `app-*`.
4. Add `JST.configure({ dev: true })` locally and in preview environments.
5. Use `resolveTemplate` for lazy server-streamed components.
6. Use precompiled mode when CSP or startup cost matters.
7. Document which fragment sources are trusted.

## The Pitch

JST is not trying to beat React at app-scale client state, or HTMX at minimal
server-only hypermedia. The distinctive pitch is: **the server and browser can
both speak interactive HTML components**. The backend can send a fragment that
defines and uses a component, and the frontend can keep interacting without a
round-trip for every click.
