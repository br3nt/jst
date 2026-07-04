export const version: string;

export interface JSTConfig {
  dev: boolean;
  autoRegister: boolean;
  autoRegisterRoot: ParentNode | null;
  resolveTemplate: ((name: string) => string | URL | null | undefined | Promise<string | URL | null | undefined>) | null;
}

export interface ConfigureOptions {
  dev?: boolean;
  autoRegister?: boolean;
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

export type JSTEventHandler<E extends Event = Event> = (event: E) => unknown;

/** Handler combinators — shape WHEN a handler runs. In scope bare inside template expressions; JST.fn.* elsewhere. */
export function prevent<E extends Event>(fn?: JSTEventHandler<E>): JSTEventHandler<E>;
export function stop<E extends Event>(fn?: JSTEventHandler<E>): JSTEventHandler<E>;
export function self<E extends Event>(fn: JSTEventHandler<E>): JSTEventHandler<E>;
export function changed<E extends Event>(fn: JSTEventHandler<E>): JSTEventHandler<E>;
export function debounce<E extends Event>(ms: number, fn: JSTEventHandler<E>): JSTEventHandler<E>;
export function throttle<E extends Event>(ms: number, fn: JSTEventHandler<E>): JSTEventHandler<E>;
export function keys(map: Record<string, JSTEventHandler<KeyboardEvent>>): JSTEventHandler<KeyboardEvent>;

export interface JSTCombinators {
  prevent: typeof prevent;
  stop: typeof stop;
  self: typeof self;
  changed: typeof changed;
  debounce: typeof debounce;
  throttle: typeof throttle;
  keys: typeof keys;
}

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

/** A shaper gates/paces `fire` (the element's declared request); it can't change what firing does. */
export type JSTNavShaper = (fire: (event?: Event) => void) => JSTEventHandler;

export interface JSTNav {
  csrf: JSTNavCsrfConfig;
  configure(root?: Document | Element): void;
  /** Fire the element's declared request now (the escape hatch for exotic causes). */
  request(element: Element, sourceEvent?: Event): Promise<void>;
  /** Register a named shaper for jst-on<event>="name" attributes. */
  shape(name: string, shaper: JSTNavShaper): void;
  performRequest?(element: Element, sourceEvent?: Event): Promise<void>;
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
