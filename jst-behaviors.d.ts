import type { JSTGlobal } from './index';

export function configure(root?: Document | Element): void;

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
}
