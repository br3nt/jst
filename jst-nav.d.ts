import type { JSTGlobal, JSTNavSwapOptions } from './index';

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

export function configure(root?: Document | Element): void;
/** Fetch url and swap the response into target — the imperative primitive. */
export function swap(target: Element | string | null, url: string, options?: JSTNavSwapOptions): Promise<Response>;

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
}
