// ─── UI Theme — load from storage and apply via data-theme attribute ──────────

import type { UITheme } from './types';

export function applyTheme(theme: UITheme): void {
  document.body.setAttribute('data-theme', theme);
}

export async function loadAndApplyTheme(): Promise<void> {
  try {
    const { uiTheme = 'ocean' } =
      await chrome.storage.local.get('uiTheme') as { uiTheme?: UITheme };
    applyTheme(uiTheme);
  } catch { /* ignore — outside extension context */ }
}
