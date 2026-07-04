import type { JSTGlobal, JSTNavShaper } from './index';

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

export function configure(root?: Document | Element): void;
/** Fire the element's declared request now (the escape hatch for exotic causes). */
export function performRequest(element: Element, sourceEvent?: Event): Promise<void>;
/** Register a named shaper for jst-on<event>="name" attributes. */
export function shape(name: string, shaper: JSTNavShaper): void;

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
}
