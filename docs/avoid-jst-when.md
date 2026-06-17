# Avoid JST when

JST has a narrow philosophy: no build, props down and events up, controlled
components, state lives in the page or on the server, no store or proxies or
signals. That philosophy is a feature for some apps and a tax on others. Here is
where JST is the wrong tool.

## Large client-owned SPAs

If your application's state lives on the client, deep client routing, optimistic
UI everywhere, a normalised client cache, cross-cutting derived state, then JST
will fight you. JST deliberately has no store, no signals, and no global
reactive graph. You would end up rebuilding one by hand. Reach for React, Vue,
Solid, or Svelte, which are built for that shape.

## Huge keyed/virtualized lists

JST does in-place DOM morphing, with keyed reconciliation via `jst-key` for
correctness across reorders. It does not ship a virtualization layer. If you
need to render tens of thousands of rows with windowing and recycling, use a
library built for that. You can embed one, but JST will not do it for you.

## Heavy client routing and client state

A client router with nested layouts, route-level data loading, transitions, and
a state container is a SPA. That is the thing JST is consciously not. If routing
and state orchestration are the core of your app, pick a framework that treats
them as first-class.

## Strict CSP *and* a zero-build workflow, both at once

JST's browser compiler turns each template into a render function via
`new Function`, which strict Content-Security-Policy without `'unsafe-eval'`
blocks. Strict CSP itself is supported: `tools/precompile.mjs` compiles templates
ahead of time so they register under `script-src 'self'` with no `new Function`
(see [production.md](./production.md) and [known-gaps.md](./known-gaps.md)). The
catch is that precompiling is a build step. If you want strict CSP *and* refuse
any build step, those two goals conflict — pick one.

## You want a big ecosystem

JST is small and young. No mature component libraries, no devtools extension on
a marketplace yet, no large plugin ecosystem, no Stack Overflow back catalogue.
If your team's velocity depends on off-the-shelf component kits, design systems
with framework bindings, and a deep hiring pool, that ecosystem does not exist
here yet.

## You want magic reactivity

There are no proxies tracking your reads, no auto-tracked effects, no dependency
arrays, no signals. You re-render by assigning a property. If you want a system
that re-runs computations automatically when their inputs change, JST is the
wrong model on purpose. See [no-store-no-proxy.md](./no-store-no-proxy.md).

## Honest summary

JST is for HTML-first apps where the server (or the page) owns state and you want
interactivity without a build. The further your app is from that, the more JST's
constraints cost you. Pick the tool that matches the shape of your problem.
