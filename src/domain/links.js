/**
 * Enlaces asociados a tareas, actividades y resultados.
 */
import { LINK_KIND, LINK_KIND_PATTERNS, SAFE_LINK_PROTOCOLS, URL_PATTERN } from '../constants/records.js';

/**
 * @typedef {import('../constants/records.js').LinkKind} LinkKind
 * @typedef {{url: string, kind: LinkKind, label: string}} Link
 */

/**
 * @param {string} url
 * @returns {LinkKind}
 */
export function detectLinkKind(url) {
  return LINK_KIND_PATTERNS.find(({ pattern }) => pattern.test(url))?.kind ?? LINK_KIND.OTHER;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  return [...new Set(text.match(URL_PATTERN) ?? [])];
}

/**
 * @param {string} url
 * @param {string} [label]
 * @returns {Link}
 */
export function createLink(url, label = '') {
  const trimmedUrl = url.trim();
  return { url: trimmedUrl, kind: detectLinkKind(trimmedUrl), label: label.trim() };
}

/**
 * Solo se renderizan como `href` las URLs http(s), nunca `javascript:` u otros esquemas.
 * @param {string} url
 */
export function isSafeLinkUrl(url) {
  try {
    return SAFE_LINK_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Texto corto para mostrar un enlace.
 * @param {Link} link
 */
export function describeLink(link) {
  if (link.label) return link.label;
  try {
    const parsed = new URL(link.url);
    const path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.hostname}${path}`;
  } catch {
    return link.url;
  }
}
