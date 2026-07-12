/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
/**
 * Shared component-gallery module. One manifest + one card renderer, consumed by
 * two pages:
 *   - examples/components_cross_section.html (the standalone gallery, basePath
 *     "components/"), which loads jst-layout.css + jst-components.css globally.
 *   - index.html (the landing, basePath "examples/components/"), which has its
 *     OWN bespoke palette and does NOT load the jst stylesheets.
 *
 * So this module is self-contained: it injects the design tokens, the theme
 * skins, the .jst-tag badge and the card chrome as one stylesheet, scoped so it
 * cannot leak into a host page's own elements:
 *   - tokens/skins live in @layer jst.tokens / jst.components. They are pure
 *     custom-property definitions, so they never restyle a host element by
 *     themselves. NOTE: on the gallery page (which also loads the global
 *     jst-layout.css / jst-components.css) the injected copy sits in the SAME
 *     layers but later in source order, so THIS copy wins for the host chrome —
 *     it is the source of truth there. Keep the token/skin blocks below in sync
 *     with jst-layout.css / jst-components.css when a skin changes, or the card
 *     chrome will silently diverge from the mini-page iframes (which load the
 *     global sheets). The element rules those sheets add for material/daisy
 *     (filled inputs, borderless jst-box) are intentionally omitted: the host
 *     chrome renders no such elements, only the iframes do.
 *   - the card chrome, badge and legend are all scoped under `.jst-gallery`, so
 *     they only touch the gallery's own subtree, never the host page's prose.
 * Every example is a separate mini page loaded in its own <iframe>; nothing here
 * depends on the framework it is showing off.
 */

// The four stages, each an array of card manifests. name → mini page filename;
// tech → badge colour role; badge → literal tag text; height → iframe height;
// desc → HTML blurb (interpolated as innerHTML, authored copy only).
export const GROUPS = [
  {
    heading: 'Native-first: the platform already does it',
    blurb: 'These need no framework. Modern HTML and CSS ship the behaviour; JST just gives them a consistent, themeable skin.',
    items: [
      { name: 'modal', title: 'Modal / Dialog', tech: 'none', badge: 'HTML + CSS', height: 420,
        desc: 'Open, close, focus-trap and backdrop dismiss for a real overlay, driven declaratively. Built on <code>&lt;dialog&gt;</code> with <code>command</code>/<code>commandfor</code> invokers and <code>closedby="any"</code> &mdash; no script wiring.' },
      { name: 'drawer', title: 'Drawer / offcanvas', tech: 'none', badge: 'HTML + CSS + JS', height: 420,
        desc: 'An edge-docked panel for filters and navigation. The same native <code>&lt;dialog&gt;</code> as the modal; <code>data-side="start | end | top | bottom"</code> picks the edge it slides in from.' },
      { name: 'dropdown', title: 'Dropdown menu', tech: 'none', badge: 'HTML + CSS', height: 300,
        desc: 'An anchored menu with outside-click and <kbd>Esc</kbd> dismissal for free. Uses the <code>[popover]</code> attribute, <code>command="toggle-popover"</code>, and CSS anchor positioning.' },
      { name: 'accordion', title: 'Accordion', tech: 'none', badge: 'HTML + CSS', height: 300,
        desc: 'A single-open disclosure group. Three <code>&lt;details name="acc"&gt;</code> sharing a <code>name</code> become mutually exclusive &mdash; a Baseline platform feature, no component.' },
      { name: 'switch', title: 'Switch', tech: 'none', badge: 'HTML + CSS', height: 150,
        desc: 'A toggle that is a real form control. It is a styled <code>&lt;input type="checkbox"&gt;</code>, so keyboard, focus and form submission all work with zero extra code.' },
      { name: 'tooltip', title: 'Tooltip', tech: 'none', badge: 'HTML + CSS', height: 180,
        desc: 'A hover/focus hint on any element, with no positioning library. Rendered from a <code>data-tip</code> attribute via a CSS <code>::after</code> pseudo-element.' },
      { name: 'alert', title: 'Alert / Callout', tech: 'none', badge: 'HTML + CSS + JS', height: 340,
        desc: 'Status messaging in success, warning and error tones. One class plus <code>data-variant</code> re-colours the callout from the theme tokens. The dismissable pair adds a × button that animates the alert away on <code>transitionend</code>, and removes it instantly under <code>prefers-reduced-motion</code>.' },
      { name: 'progress', title: 'Progress &amp; Spinner', tech: 'none', badge: 'HTML + CSS', height: 170,
        desc: 'Determinate and indeterminate loading feedback. A native <code>&lt;progress&gt;</code> element plus a CSS keyframe spinner &mdash; accessible by default.' },
      { name: 'validation', title: 'Validation states', tech: 'none', badge: 'HTML + CSS', height: 360,
        desc: 'Inline field validation that does not nag you while typing: the field turns invalid only after you interact, via the platform pseudo-class <code>:user-invalid</code>. Note <code>type="email"</code> accepts a TLD-less address like <code>a@b</code> (intranet hosts are legal email) &mdash; add a <code>pattern</code> when you want to require a dot-TLD.' },
      { name: 'reveal-on-scroll', title: 'Reveal on scroll', tech: 'none', badge: 'HTML + CSS', height: 360,
        desc: 'Scroll-linked entrance animation with no IntersectionObserver. <code>animation-timeline: view()</code> ties the effect to the scroll box, and it is disabled for reduced-motion users.' },
    ],
  },
  {
    heading: 'JST components: real custom elements',
    blurb: 'Where the platform has no built-in element, JST ships a genuine custom element. The template you see in "View source" is the whole implementation &mdash; there is no compiled black box.',
    items: [
      { name: 'tabs', title: 'Tabs', tech: 'jst', badge: '<jst-tabs>', height: 260,
        desc: 'A tabbed panel with roving <code>tabindex</code>, <code>aria-selected</code> and arrow-key navigation. There is no native tabs element, so this is a real JST custom element you configure with one <code>tabs</code> attribute.' },
      { name: 'combobox', title: 'Combobox / Autocomplete', tech: 'jst', badge: '<jst-combobox>', height: 420,
        desc: 'A filter-as-you-type picker with full keyboard support and correct <code>combobox</code>/<code>listbox</code> ARIA roles. Static options come from a JSON attribute; async is the same element &mdash; a handler debounces the input, fetches, and assigns <code>el.options</code>. There is no separate remote API.' },
      { name: 'table', title: 'Data table (sortable)', tech: 'jst', badge: '<jst-table>', height: 300,
        desc: 'A column-sortable table driven by data. Click a header to sort, again to reverse; <code>aria-sort</code> reflects the state. Columns and rows are plain JSON attributes.' },
      { name: 'toaster', title: 'Toast notifications', tech: 'jst', badge: '<jst-toaster>', height: 420,
        desc: 'A transient notification stack that auto-dismisses. Buttons raise a custom <code>--toast</code> command carrying the message on their <code>data-*</code>; the toaster reads it and renders.' },
      { name: 'command-palette', title: 'Command palette', tech: 'jst', badge: '<jst-palette>', height: 440,
        desc: 'A searchable action launcher on <kbd>&#8984;K</kbd> / <kbd>Ctrl+K</kbd> &mdash; the pattern React apps reach for a library to get. The page owns the command list; the palette filters, and emits a <code>run</code> event the page executes.' },
      { name: 'lazy-region', title: 'Lazy region', tech: 'jst', badge: '<jst-include>', height: 200,
        desc: 'A region whose content lives at a URL and arrives on demand. <code>&lt;jst-include&gt;</code> fetches the fragment; the fragment can even carry its own component definition, which auto-registers on arrival.' },
      { name: 'lazy-accordion', title: 'Lazy accordion', tech: 'jst', badge: '<jst-include>', height: 300,
        desc: 'Fetch a panel body only when it is opened. A <code>&lt;jst-include when="visible"&gt;</code> inside a closed <code>&lt;details&gt;</code> is not rendered, so the request fires the moment you expand it.' },
    ],
  },
  {
    heading: "Layout: JST's CSS-only layout hooks",
    blurb: 'Structural primitives you drop into markup and tune with a custom property. No JavaScript &mdash; these are pure CSS selectors on <code>&lt;jst-*&gt;</code> elements and <code>data-</code> hooks.',
    items: [
      { name: 'carousel', title: 'Carousel', tech: 'layout', badge: '<jst-reel>', height: 260,
        desc: 'A horizontally scrolling, snap-stopping slide track. <code>&lt;jst-reel&gt;</code> lays out the slides; CSS scroll-snap does the paging, with arrows and dots where the engine supports CSS carousels.' },
      { name: 'container-query', title: 'Container queries', tech: 'layout', badge: '[data-container]', height: 300,
        desc: 'A component that reflows to the space it is given, not the viewport. Drag the handle: <code>[data-container]</code> makes the box a query container, so the stats stack when it is narrow.' },
    ],
  },
  {
    heading: 'Patterns: the everyday building blocks',
    blurb: 'The small, repetitive pieces every app ships. Plain HTML and a handful of classes, themed from the same tokens as everything else.',
    items: [
      { name: 'button-variants', title: 'Button variants', tech: 'none', badge: 'HTML + CSS', height: 150,
        desc: 'One button element, re-roled by attribute: accent by default, <code>data-variant="quiet | ghost | danger"</code> for the rest.' },
      { name: 'badge', title: 'Badge &amp; Avatar', tech: 'none', badge: 'HTML + CSS', height: 200,
        desc: 'Status pills and initial avatars for lists and tables. Colour comes from <code>data-variant</code>; avatar size from a <code>--size</code> custom property.' },
      { name: 'page-header', title: 'Page header &amp; Stats', tech: 'none', badge: 'HTML + CSS', height: 300,
        desc: 'A titled page header with actions and a row of key figures &mdash; the top of almost every dashboard screen. Trend arrows come from <code>data-trend</code>.' },
      { name: 'empty-state', title: 'List &amp; Empty state', tech: 'none', badge: 'HTML + CSS + JS', height: 380,
        desc: 'A live member list with the designed empty state it falls back to &mdash; the placeholder every dashboard needs. Removing rows with the × eventually empties the list and reveals the empty block; "Invite someone" adds a member back.' },
      { name: 'skeleton', title: 'Skeleton', tech: 'jst', badge: '<jst-include>', height: 560,
        desc: 'Shimmering placeholder shapes &mdash; text lines, avatar-and-lines, and a card &mdash; for content that has not loaded (the shapes themselves are pure CSS). Dropped inside a <code>&lt;jst-include&gt;</code> as its pre-fetch content, the fetched fragment swaps them out; "Replay" re-runs that swap so you can watch it.' },
      { name: 'breadcrumb', title: 'Breadcrumb &amp; Pagination', tech: 'none', badge: 'HTML + CSS', height: 240,
        desc: 'The navigation trail and page controls every server-rendered app emits. Plain <code>&lt;nav&gt;</code> markup; <code>aria-current</code> carries the state.' },
      { name: 'input-group', title: 'Input group / Join', tech: 'none', badge: 'HTML + CSS', height: 240,
        desc: 'Inputs, addons and buttons welded into one control. One rule set joins both text-field addons and segmented button groups.' },
    ],
  },
];

// A theme name is a bare CSS identifier: it flows into an iframe src query and a
// [data-theme] attribute, so keep it to lowercase alnum. w3css (has a digit) is
// the regression this shape guards — a letters-only regex once rejected it.
export const validTheme = (t) => typeof t === 'string' && /^[a-z][a-z0-9]*$/.test(t);

// Self-contained gallery stylesheet. Injected once. See the module header for
// why tokens/skins are layered and the chrome is scoped under `.jst-gallery`.
const GALLERY_CSS = `
@layer jst.tokens, jst.base, jst.primitives, jst.components;

@layer jst.tokens {
:root {
  --jst-space: 0.625rem;
  --jst-ratio: 1.5;
  --jst-space-3xs: calc(var(--jst-space) / var(--jst-ratio) / var(--jst-ratio) / var(--jst-ratio));
  --jst-space-2xs: calc(var(--jst-space) / var(--jst-ratio) / var(--jst-ratio));
  --jst-space-xs:  calc(var(--jst-space) / var(--jst-ratio));
  --jst-space-s:   calc(var(--jst-space) / 1.2);
  --jst-space-m:   var(--jst-space);
  --jst-space-l:   calc(var(--jst-space) * var(--jst-ratio));
  --jst-space-xl:  calc(var(--jst-space) * var(--jst-ratio) * var(--jst-ratio));
  --jst-space-2xl: calc(var(--jst-space) * var(--jst-ratio) * var(--jst-ratio) * var(--jst-ratio));
  --jst-measure: 60ch;
  --jst-radius: 0.1875rem;
  --jst-border-width: 1px;
  --jst-font: system-ui, sans-serif;
  --jst-font-mono: ui-monospace, monospace;
  --jst-font-size: 0.875rem;
  --jst-line: 1.45;
  --jst-control-size: 0.8rem;
  --jst-bg:      light-dark(oklch(0.99 0 0), oklch(0.18 0.01 250));
  --jst-surface: light-dark(oklch(0.96 0 0), oklch(0.23 0.01 250));
  --jst-fg:      light-dark(oklch(0.22 0.01 250), oklch(0.93 0.01 250));
  --jst-muted:   light-dark(oklch(0.50 0.01 250), oklch(0.70 0.01 250));
  --jst-border:  light-dark(oklch(0.87 0.01 250), oklch(0.35 0.01 250));
  --jst-accent:     oklch(0.55 0.18 255);
  --jst-accent-400: oklch(from var(--jst-accent) calc(l + 0.10) c h);
  --jst-accent-600: oklch(from var(--jst-accent) calc(l - 0.08) c h);
  --jst-accent-700: oklch(from var(--jst-accent) calc(l - 0.16) c h);
  --jst-accent-fg: white;
  --jst-ok: oklch(0.62 0.15 150);
  --jst-warn: oklch(0.75 0.15 80);
  --jst-error: oklch(0.55 0.19 25);
  --jst-ok-fg: white;
  --jst-warn-fg: oklch(0.25 0.05 80);
  --jst-error-fg: white;
  --jst-shadow: 0 0.25rem 0.75rem oklch(0 0 0 / 0.12);
  --jst-backdrop: oklch(0 0 0 / 0.45);
  --jst-shadow-surface: none;
  --jst-font-small: 0.8rem;
}
[data-scheme="light"] { color-scheme: light; }
[data-scheme="dark"]  { color-scheme: dark; }
@supports not (color: light-dark(white, black)) {
  :root {
    --jst-bg: oklch(0.99 0 0); --jst-surface: oklch(0.96 0 0);
    --jst-fg: oklch(0.22 0.01 250); --jst-muted: oklch(0.50 0.01 250);
    --jst-border: oklch(0.87 0.01 250);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --jst-bg: oklch(0.18 0.01 250); --jst-surface: oklch(0.23 0.01 250);
      --jst-fg: oklch(0.93 0.01 250); --jst-muted: oklch(0.70 0.01 250);
      --jst-border: oklch(0.35 0.01 250);
    }
  }
}
} /* @layer jst.tokens */

@layer jst.components {
[data-theme="jst"]       { --jst-ring: 0 0 0 2px oklch(from var(--jst-accent) l c h / 0.45); }
[data-theme="bootstrap"] {
  --jst-accent: oklch(0.55 0.20 262); --jst-radius: 0.375rem;
  --jst-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --jst-border: light-dark(oklch(0.86 0.005 262), oklch(0.38 0.01 262));
  --jst-shadow-surface: 0 0.125rem 0.25rem oklch(0 0 0 / 0.075);
  --jst-shadow: 0 0.5rem 1rem oklch(0 0 0 / 0.15);
  --jst-ring: 0 0 0 0.25rem oklch(0.55 0.20 262 / 0.5);
}
[data-theme="shadcn"] {
  --jst-accent: oklch(0.22 0.006 285); --jst-radius: 0.5rem; --jst-font: system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.92 0.004 285), oklch(0.30 0.006 285));
  --jst-shadow-surface: 0 1px 2px oklch(0 0 0 / 0.06);
  --jst-shadow: 0 0.25rem 0.75rem oklch(0 0 0 / 0.10);
  --jst-ring: 0 0 0 2px var(--jst-bg), 0 0 0 4px oklch(0.55 0.01 285);
}
[data-theme="shoelace"] {
  --jst-accent: oklch(0.68 0.14 233); --jst-radius: 0.25rem; --jst-font: system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.90 0.01 233), oklch(0.33 0.01 233));
  --jst-shadow-surface: 0 1px 2px oklch(0.55 0.05 233 / 0.14);
  --jst-shadow: 0 0.25rem 1rem oklch(0.55 0.05 233 / 0.18);
  --jst-ring: 0 0 0 3px oklch(0.68 0.14 233 / 0.4);
}
[data-theme="pico"] {
  --jst-accent: oklch(0.52 0.16 277); --jst-radius: 0.75rem; --jst-font: system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.91 0.01 277), oklch(0.32 0.01 277));
  --jst-shadow-surface: 0 0.125rem 1rem oklch(0.3 0.05 277 / 0.10);
  --jst-shadow: 0 0.5rem 1.5rem oklch(0.3 0.05 277 / 0.12);
  --jst-ring: 0 0 0 3px oklch(0.52 0.16 277 / 0.35);
}
[data-theme="w3css"] {
  --jst-accent: oklch(0.62 0.12 236); --jst-radius: 0; --jst-font: "Segoe UI", Arial, sans-serif;
  --jst-border-width: 1px; --jst-border: light-dark(oklch(0.72 0 0), oklch(0.48 0 0));
  --jst-shadow-surface: none;
  --jst-shadow: 0 2px 5px oklch(0 0 0 / 0.16), 0 2px 10px oklch(0 0 0 / 0.12);
  --jst-ring: 0 0 0 2px oklch(0.62 0.12 236 / 0.6);
}
[data-theme="bulma"] {
  --jst-accent: oklch(0.74 0.13 184); --jst-radius: 0.375rem; --jst-font: "Helvetica Neue", system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.86 0.005 184), oklch(0.38 0.01 184));
  --jst-shadow-surface: 0 0.5em 1em -0.125em oklch(0.3 0.02 184 / 0.1), 0 0 0 1px oklch(0.3 0.02 184 / 0.02);
  --jst-shadow: 0 0.5em 1em -0.125em oklch(0.3 0.02 184 / 0.15);
  --jst-ring: 0 0 0 0.125em oklch(0.74 0.13 184 / 0.4);
}
[data-theme="material"] {
  --jst-accent: oklch(0.47 0.15 300); --jst-radius: 1rem; --jst-font: "Roboto", system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.55 0.01 300 / 0.28), oklch(0.85 0.01 300 / 0.22));
  --jst-surface: light-dark(oklch(0.95 0.006 300), oklch(0.27 0.008 300));
  --jst-shadow-surface: 0 1px 3px oklch(0 0 0 / 0.2), 0 4px 8px oklch(0 0 0 / 0.12);
  --jst-shadow: 0 1px 3px oklch(0 0 0 / 0.3), 0 4px 8px oklch(0 0 0 / 0.15);
  --jst-ring: 0 0 0 3px oklch(0.47 0.15 300 / 0.4);
}
[data-theme="antd"] {
  --jst-accent: oklch(0.58 0.17 258); --jst-radius: 0.375rem; --jst-font: -apple-system, "Segoe UI", Roboto, sans-serif;
  --jst-border: light-dark(oklch(0.92 0.004 258), oklch(0.31 0.008 258));
  --jst-shadow-surface: 0 1px 2px oklch(0 0 0 / 0.06), 0 1px 6px -1px oklch(0 0 0 / 0.05);
  --jst-shadow: 0 6px 16px oklch(0 0 0 / 0.08), 0 3px 6px oklch(0 0 0 / 0.12);
  --jst-ring: 0 0 0 2px oklch(0.58 0.17 258 / 0.3);
}
[data-theme="tailwind"] {
  --jst-accent: oklch(0.51 0.23 277); --jst-radius: 0.5rem; --jst-font: ui-sans-serif, system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.93 0.004 277), oklch(0.33 0.008 277));
  --jst-shadow-surface: 0 1px 2px oklch(0 0 0 / 0.05);
  --jst-shadow: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);
  --jst-ring: 0 0 0 2px var(--jst-bg), 0 0 0 4px oklch(0.51 0.23 277 / 0.5);
}
[data-theme="daisy"] {
  --jst-accent: oklch(0.49 0.24 277); --jst-radius: 1rem; --jst-font: system-ui, sans-serif;
  --jst-border: light-dark(oklch(0.55 0.015 277 / 0.28), oklch(0.85 0.015 277 / 0.22));
  --jst-surface: light-dark(oklch(0.96 0.01 277), oklch(0.27 0.012 277));
  --jst-shadow-surface: 0 4px 14px oklch(0.4 0.05 277 / 0.12);
  --jst-shadow: 0 4px 12px oklch(0 0 0 / 0.12);
  --jst-ring: 0 0 0 2px oklch(0.49 0.24 277 / 0.4);
}
} /* @layer jst.components */

/* Card chrome, badge and legend — scoped to the gallery subtree so they cannot
   touch a host page's own elements. Unlayered so they reliably style the cards.
   color-scheme lives on the container (not :root) so light-dark() tokens
   follow the OS inside the gallery without flipping a host page's own scheme. */
.jst-gallery { color-scheme: light dark; }

.jst-gallery .jst-tag {
  display: inline-flex; align-items: center; gap: 0.35em;
  font-family: var(--jst-font-mono); font-size: 0.7rem; font-weight: 600;
  padding: 0.15em 0.6em; border-radius: 99px; white-space: nowrap;
  border: 1px solid transparent;
}
.jst-gallery .jst-tag::before { content: "\\25CF"; font-size: 0.8em; }
.jst-gallery .jst-tag[data-tech="none"]   { background: oklch(0.95 0.05 150); color: oklch(0.40 0.12 150); border-color: oklch(0.85 0.08 150); }
.jst-gallery .jst-tag[data-tech="layout"] { background: oklch(0.95 0.04 300); color: oklch(0.45 0.12 300); border-color: oklch(0.87 0.06 300); }
.jst-gallery .jst-tag[data-tech="jst"]    { background: oklch(0.93 0.06 30);  color: oklch(0.48 0.16 30);  border-color: oklch(0.85 0.09 30); }
@media (prefers-color-scheme: dark) {
  .jst-gallery .jst-tag[data-tech="none"]   { background: oklch(0.30 0.06 150); color: oklch(0.85 0.10 150); border-color: oklch(0.40 0.08 150); }
  .jst-gallery .jst-tag[data-tech="layout"] { background: oklch(0.30 0.05 300); color: oklch(0.86 0.08 300); border-color: oklch(0.40 0.07 300); }
  .jst-gallery .jst-tag[data-tech="jst"]    { background: oklch(0.32 0.08 30);  color: oklch(0.86 0.10 30);  border-color: oklch(0.42 0.10 30); }
}

.jst-gallery .legend { display: flex; flex-wrap: wrap; gap: var(--jst-space-s) var(--jst-space-l); font-size: var(--jst-font-small); color: var(--jst-muted); }
.jst-gallery .legend > span { display: inline-flex; align-items: baseline; gap: var(--jst-space-2xs); }
.jst-gallery .legend .dot { inline-size: 0.7em; block-size: 0.7em; border-radius: 50%; translate: 0 0.05em; }
.jst-gallery .legend .dot[data-tech="none"]   { background: oklch(0.55 0.14 150); }
.jst-gallery .legend .dot[data-tech="jst"]    { background: oklch(0.58 0.18 30); }
.jst-gallery .legend .dot[data-tech="layout"] { background: oklch(0.55 0.14 300); }

/* .stage is a <section>; a host page (the landing) may style bare <section>,
   so neutralise padding/border here and set the heading size, keeping both
   pages identical regardless of the host's element defaults. */
.jst-gallery .stage { margin-block-start: var(--jst-space-xl); padding: 0; border: 0; }
.jst-gallery .stage > h2 { margin: 0 0 var(--jst-space-2xs); font-size: 1.15rem; font-weight: 700; }
.jst-gallery .stage > p { margin: 0 0 var(--jst-space-m); color: var(--jst-muted); max-inline-size: 60ch; }

.jst-gallery .grid {
  display: grid; gap: var(--jst-space-l);
  grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
}
.jst-gallery .card {
  border: var(--jst-border-width) solid var(--jst-border); border-radius: var(--jst-radius);
  background: var(--jst-bg); overflow: clip;
  display: flex; flex-direction: column;
  color: var(--jst-fg);
}
.jst-gallery .card > header { display: flex; align-items: center; justify-content: space-between; gap: var(--jst-space-s); padding: var(--jst-space-s) var(--jst-space-m); }
.jst-gallery .card h3 { margin: 0; font-size: var(--jst-font-h3, 1.05rem); }
.jst-gallery .card .frame-wrap { border-block: var(--jst-border-width) solid var(--jst-border); background: var(--jst-surface); }
.jst-gallery .card iframe { display: block; inline-size: 100%; border: 0; background: var(--jst-bg); }
.jst-gallery .card .desc { margin: 0; padding: var(--jst-space-s) var(--jst-space-m); color: var(--jst-muted); font-size: var(--jst-font-small); }
.jst-gallery .card .desc code { color: var(--jst-fg); }
.jst-gallery .card > footer { margin-block-start: auto; display: flex; align-items: center; justify-content: space-between; gap: var(--jst-space-s); flex-wrap: wrap; padding: var(--jst-space-s) var(--jst-space-m); border-block-start: var(--jst-border-width) solid var(--jst-border); font-size: var(--jst-font-small); }
.jst-gallery .card > footer a { white-space: nowrap; color: var(--jst-accent-600, var(--jst-accent)); }
.jst-gallery .card details { min-inline-size: 0; }
.jst-gallery .card details > summary { cursor: pointer; color: var(--jst-accent-600, var(--jst-accent)); }
.jst-gallery .card details pre { margin: var(--jst-space-xs) 0 0; max-block-size: 22rem; overflow: auto; background: var(--jst-surface); border: var(--jst-border-width) solid var(--jst-border); border-radius: var(--jst-radius); padding: var(--jst-space-s); font-size: 0.78rem; line-height: 1.5; }
.jst-gallery .card details pre code { white-space: pre; color: var(--jst-fg); }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.getElementById('jst-gallery-styles')) { stylesInjected = true; return; }
  const style = document.createElement('style');
  style.id = 'jst-gallery-styles';
  style.textContent = GALLERY_CSS;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * Render the full card grid into `container` and wire the re-skin dropdown.
 *
 * @param {object}      opts
 * @param {HTMLElement} opts.container   grid host; gets the `.jst-gallery` scope class.
 * @param {string}     [opts.basePath]   path prefix to the mini pages (trailing slash).
 * @param {HTMLSelectElement} [opts.themeSelect]  the "Re-skin as:" <select>.
 * @param {HTMLElement} [opts.themeTarget] element that carries [data-theme]; its
 *   subtree (the cards) inherits the skin tokens. Defaults to `container`.
 * @returns {{ frames: HTMLIFrameElement[], links: HTMLAnchorElement[], currentTheme: () => string }}
 */
export function renderGallery({ container, basePath = 'components/', themeSelect, themeTarget } = {}) {
  injectStyles();
  container.classList.add('jst-gallery');
  const target = themeTarget || container;
  const frames = [];
  const links = [];

  const currentTheme = () =>
    (themeSelect && validTheme(themeSelect.value)) ? themeSelect.value : 'jst';

  // Honour a ?theme= on the page URL BEFORE building cards, so each iframe src
  // starts on the right theme with no reload.
  const initial = new URLSearchParams(location.search).get('theme');
  if (validTheme(initial) && themeSelect) themeSelect.value = initial;
  target.dataset.theme = currentTheme();

  function buildCard(item) {
    const theme = currentTheme();
    const href = `${basePath}${item.name}.html`;
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('header');
    const h3 = document.createElement('h3');
    h3.innerHTML = item.title;
    const badge = document.createElement('span');
    badge.className = 'jst-tag';
    badge.dataset.tech = item.tech;
    badge.textContent = item.badge; // literal text, so <jst-tabs> shows as written
    header.append(h3, badge);

    const frameWrap = document.createElement('div');
    frameWrap.className = 'frame-wrap';
    const iframe = document.createElement('iframe');
    iframe.src = `${href}?theme=${theme}`;
    iframe.loading = 'lazy';
    iframe.setAttribute('scrolling', 'no');
    iframe.style.height = item.height + 'px';
    iframe.title = `${item.title} (live preview)`;
    // Lazy frames may load AFTER a theme change: the src carries the theme that
    // was current when the card was built, so re-send the live theme on load.
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({ type: 'jst-theme', theme: currentTheme() }, '*');
    });
    frameWrap.append(iframe);
    frames.push(iframe);

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.innerHTML = item.desc;

    const footer = document.createElement('footer');
    const open = document.createElement('a');
    open.href = `${href}?theme=${theme}`;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Open standalone ↗';
    links.push(open);

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'View source';
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    pre.append(code);
    details.append(summary, pre);
    let loaded = false;
    details.addEventListener('toggle', async () => {
      if (!details.open || loaded) return;
      loaded = true;
      code.textContent = 'Loading…';
      try {
        const res = await fetch(href);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const match = html.match(/<!--\s*example:start\s*-->([\s\S]*?)<!--\s*example:end\s*-->/);
        const raw = match ? match[1].replace(/^\n+|\s+$/g, '') : '(source markers not found)';
        // Strip the common leading indentation for a tidy snippet.
        const lines = raw.split('\n');
        const widths = lines.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length);
        const indent = widths.length ? Math.min(...widths) : 0;
        code.textContent = lines.map(l => l.slice(indent)).join('\n');
      } catch (e) {
        code.textContent = 'Could not load source.';
      }
    });

    footer.append(open, details);
    card.append(header, frameWrap, desc, footer);
    return card;
  }

  for (const group of GROUPS) {
    const stage = document.createElement('section');
    stage.className = 'stage';
    const h2 = document.createElement('h2');
    h2.innerHTML = group.heading;
    const blurb = document.createElement('p');
    blurb.innerHTML = group.blurb;
    const grid = document.createElement('div');
    grid.className = 'grid';
    group.items.forEach(item => grid.append(buildCard(item)));
    stage.append(h2, blurb, grid);
    container.append(stage);
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const theme = currentTheme();
      target.dataset.theme = theme;
      frames.forEach(f => f.contentWindow?.postMessage({ type: 'jst-theme', theme }, '*'));
      links.forEach(a => { a.href = a.href.replace(/\?theme=[a-z][a-z0-9]*/, `?theme=${theme}`); });
    });
  }

  return { frames, links, currentTheme };
}
