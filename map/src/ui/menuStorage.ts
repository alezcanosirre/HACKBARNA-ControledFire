export const MENU_STORAGE_KEY = 'cf.menu.collapsed';

/**
 * Contraído se recuerda entre sesiones (UX.md §3): si alguien lo dejó cerrado, sigue
 * cerrado. Se lee una sola vez, en el inicializador del estado.
 */
export function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(MENU_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
