import type { JSTGlobal, JSTNavSwapOptions, JSTNavNavigateOptions } from './index';

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

export function configure(root?: Document | Element): void;
/** Fetch url and swap the response into target — the imperative primitive. */
export function swap(target: Element | string | null, url: string, options?: JSTNavSwapOptions): Promise<Response>;
/** Programmatic navigation with the FULL enhanced-element pipeline: lifecycle events, confirm, select, history. Returns the Response, or null when cancelled. */
export function navigate(url: string, options?: JSTNavNavigateOptions): Promise<Response | null>;

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
}
