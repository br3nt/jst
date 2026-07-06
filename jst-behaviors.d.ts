import type { JSTGlobal } from './index';

export function configure(root?: Document | Element): void;

/** <jst-include src="/fragment" [when="visible"]> — a region whose content lives at a URL. */
export class JstInclude extends HTMLElement {}

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
  interface HTMLElementTagNameMap {
    'jst-include': JstInclude;
  }
}
