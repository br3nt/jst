import type { JSTGlobal } from './index';

export interface JSTNavCsrfConfig {
  metaName: string;
  headerName: string;
}

export function configure(root?: Document | Element): void;

declare global {
  interface Window {
    JST?: JSTGlobal;
  }
}
