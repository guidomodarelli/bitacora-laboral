/**
 * Normalización de texto para búsquedas insensibles a mayúsculas y acentos.
 */

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
  return String(text ?? '').normalize('NFD').replace(DIACRITICS_PATTERN, '').toLowerCase().trim();
}

/**
 * @param {string} haystack
 * @param {string} normalizedNeedle Texto ya normalizado.
 */
export function includesNormalized(haystack, normalizedNeedle) {
  return normalizeSearchText(haystack).includes(normalizedNeedle);
}
