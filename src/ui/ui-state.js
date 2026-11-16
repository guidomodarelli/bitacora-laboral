/**
 * Estado efímero de la interfaz: textos a medio escribir (sobreviven a re-renders)
 * y preferencias no críticas en localStorage (si no está disponible, se ignora).
 */
import { UI_PREFERENCES_STORAGE_KEY } from '../constants/storage.js';

/** @type {Map<string, any>} */
const drafts = new Map();

export const uiDrafts = {
  /** @param {string} key @param {any} [fallback] */
  get(key, fallback = undefined) {
    return drafts.has(key) ? drafts.get(key) : fallback;
  },
  /** @param {string} key @param {any} value */
  set(key, value) {
    drafts.set(key, value);
  },
  /** @param {string} key */
  delete(key) {
    drafts.delete(key);
  },
};

function readPreferences() {
  try {
    return JSON.parse(localStorage.getItem(UI_PREFERENCES_STORAGE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

/** @param {string} name @param {any} fallback */
export function loadPreference(name, fallback) {
  const preferences = readPreferences();
  return name in preferences ? preferences[name] : fallback;
}

/** @param {string} name @param {any} value */
export function savePreference(name, value) {
  try {
    localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...readPreferences(), [name]: value }));
  } catch {
    // Preferencia de conveniencia: si el almacenamiento está bloqueado, la app sigue funcionando.
  }
}
