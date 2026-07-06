export const version: string;

export interface JSTConfig {
  dev: boolean;
  autoRegister: boolean;
  /** Opt-in: wire the on* attributes the platform does not implement (component custom events, onreveal) written inline in body HTML, by evaluating the attribute string. Never enable on pages that interpolate untrusted data into HTML. */
  unsafeInlineHandlers: boolean;
  autoRegisterRoot: ParentNode | null;
  resolveTemplate: ((name: string) => string | URL | null | undefined | Promise<string | URL | null | undefined>) | null;
}

export interface ConfigureOptions {
  dev?: boolean;
  autoRegister?: boolean;
  unsafeInlineHandlers?: boolean;
  autoRegisterRoot?: ParentNode | null;
  resolveTemplate?: JSTConfig['resolveTemplate'];
}

export interface JSTTrustedHTML {
  readonly html: string;
}

export type JSTSlot = (name?: string, fallback?: unknown) => JSTTrustedHTML;
export type JSTDisconnect = <T extends () => unknown>(cleanup: T) => T;
export type JSTOnce = (key: string, setup: () => void | (() => unknown)) => undefined;

export interface JSTElement extends HTMLElement {
  emit<T = unknown>(eventName: string, detail?: T): boolean;
}

export type JSTComponentElement<Attributes extends Record<string, unknown> = Record<string, unknown>> =
  JSTElement & Attributes;

export type JSTPrecompiledRender = (...args: unknown[]) => string;

export function configure(options?: ConfigureOptions): JSTConfig;
export function trustedHTML(value: unknown): JSTTrustedHTML;
export function url(value: unknown): string;
export function registerCustomElementFromTemplate(templateElement: Element): CustomElementConstructor | undefined;
export function registerPrecompiledTemplate(
  customElementName: string,
  paramNames: string[],
  attributeToParam: Record<string, string>,
  renderFunction: JSTPrecompiledRender,
  source?: string,
): CustomElementConstructor | undefined;
export function initializeTemplates(): Map<string, unknown>;

/**
 * Handler helpers: called inside a handler body with the current event.
 * State is keyed per element + event type (+ delay). In scope inside
 * template handler bodies; JST.fn.* elsewhere.
 */
export function debounce(event: Event, ms: number, fn: () => unknown): void;
/** Guard: true on the leading edge, false inside the ms window. */
export function throttle(event: Event, ms: number): boolean;
/** Guard: true when the control's value differs from the value seen on the previous event (first comparison: the control's initial value). Idempotent per event. */
export function changed(event: Event): boolean;
/** Key dispatch on the normalized Ctrl+Alt+Meta+Shift+key combo. */
export function keys(event: KeyboardEvent, map: Record<string, (event: KeyboardEvent) => unknown>): unknown;
/** Invoker Commands dispatch on event.command ('--save' etc); unmatched commands are ignored. */
export function commands(event: Event & { command?: string }, map: Record<string, (event: Event) => unknown>): unknown;

export interface JSTCombinators {
  changed: typeof changed;
  debounce: typeof debounce;
  throttle: typeof throttle;
  keys: typeof keys;
  commands: typeof commands;
}

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

export interface JSTNavSwapOptions extends RequestInit {
  /** How the response lands: innerHTML (default), outerHTML, positions, delete, none, morph, transition. */
  swap?: string;
  /** CSS selector to pull a subtree out of the response. */
  select?: string;
}

export interface JSTNavNavigateOptions {
  /** CSS selector for where the response lands. */
  target?: string;
  swap?: string;
  select?: string;
  confirm?: string;
  method?: string;
  /** true = the request URL; a string = an explicit URL. */
  pushUrl?: boolean | string;
  replaceUrl?: boolean | string;
  /** data-* attributes set on the driver element for delegated listeners to read. */
  dataset?: Record<string, string>;
}

export interface JSTNav {
  csrf: JSTNavCsrfConfig;
  configure(root?: Document | Element): void;
  /** Fetch url and swap the response into target — the imperative primitive (no events, no history). */
  swap(target: Element | string | null, url: string, options?: JSTNavSwapOptions): Promise<Response>;
  /** Programmatic navigation with the FULL enhanced-element pipeline: lifecycle events, confirm, select, history. Returns the Response, or null when cancelled. */
  navigate(url: string, options?: JSTNavNavigateOptions): Promise<Response | null>;
}

export interface JSTBehaviors {
  configure(root?: Document | Element): void;
  reveal?(element: Element): void;
}

export interface JSTGlobal {
  version: string;
  config: JSTConfig;
  configure: typeof configure;
  trustedHTML: typeof trustedHTML;
  url: typeof url;
  registerCustomElementFromTemplate: typeof registerCustomElementFromTemplate;
  registerPrecompiledTemplate: typeof registerPrecompiledTemplate;
  initializeTemplates: typeof initializeTemplates;
  fn: JSTCombinators;
  nav?: JSTNav;
  behaviors?: JSTBehaviors;
}

declare global {
  interface Window {
    JST?: JSTGlobal;
  }

  var JST: JSTGlobal | undefined;
}
