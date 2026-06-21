# JST documentation

JavaScript Templates - no-build reactive web components in plain HTML.

## Start here
- [Writing JST](./writing-jst.md) - a practical authoring guide.
- [Decision guide](./decision-guide.md) - is JST a fit for your project?
- [Use JST when...](./use-jst-when.md) and [Avoid JST when...](./avoid-jst-when.md) - the longer form.
- [Install](./install.md) - script tag, CDN, npm.
- [Browser support](./browser-support.md).

## Core model
- [Controlled components](./controlled-components.md) - props down, events up, and the `jst-model` local form sugar.
- [No store, no proxy](./no-store-no-proxy.md) - why state stays explicit.
- [HATEOAS fragments](./hateoas-fragments.md) - server-driven HTML that carries its own components.

## Production
- [Production](./production.md) - runtime vs precompiled mode, configuration, the strict-CSP path.
- [Integration guide](./integration.md) - wiring JST into a server (Rails, Node/Express, any stack): undigested assets, fragments vs pages, definition delivery, CSP.
- [Security model](./security-model.md) - escaping, `trustedHTML()`, `url()`, trust boundaries, `resolveTemplate`.
- [Known gaps & roadmap](./known-gaps.md) - an honest list of what is shipped and what is planned.

## See it run
- **HATEOAS demo:** [`../demo/hateoas/`](../demo/hateoas/) - a service worker returns HTML
  fragments whose `<script type="jst">` definitions auto-register on insertion.
  Serve over `http://` (service workers don't run from `file://`).
- **Framework parity study:** [`../framework_parity/`](../framework_parity/) - the same
  small apps built in JST alongside other approaches.

## Changelog
- [CHANGELOG](../CHANGELOG.md).
