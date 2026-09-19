export const MENU_STORAGE_KEY = 'cf.menu.collapsed';

/**
 * Collapsed is remembered across sessions (UX.md §3): if someone left it closed, it
 * stays closed. Read once, in the state initializer.
 */
export function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(MENU_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
