import type { JSTGlobal, JSTNavSwapOptions, JSTNavNavigateOptions } from './index';

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

export function configure(root?: Document | Element): void;
/** Fetch url and swap the response into target — the imperative primitive. */
export function swap(target: Element | string | null, url: string, options?: JSTNavSwapOptions): Promise<Response>;
/**
 * Programmatic navigation with the FULL enhanced-element pipeline: lifecycle events, confirm, select, history.
 * `options.transition` opts in a View Transition, same as a declarative bare `jst-transition` attribute: the
 * synthesised driver element gets `jst-transition` set on it, so it's the one source of truth downstream.
 * Returns the Response, or null when cancelled.
 */
export function navigate(url: string, options?: JSTNavNavigateOptions): Promise<Response | null>;
/**
 * Apply `how` (innerHTML/outerHTML/beforeend/…/morph) to `target`. `forceTransition`, or `how === 'transition'`
 * (the legacy alias for innerHTML), wraps the write in a View Transition when the API is available, falling
 * back to a plain swap when it is not. Resolves to whether a live target was found and written.
 */
export function swapContent(
  target: Element | null,
  html: string,
  how?: string,
  reresolve?: (() => Element | null) | null,
  fromSelect?: boolean,
  forceTransition?: boolean,
): Promise<boolean>;

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
}
