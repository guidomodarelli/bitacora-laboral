/**
 * Íconos SVG dibujados a mano, con un solo trazo y peso (1.75px sobre una grilla de 16).
 * Reemplazan emojis y glifos Unicode, que cambian de aspecto según el sistema operativo.
 */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ICON_VIEWBOX = '0 0 16 16';

/** Trazos de cada ícono (atributo `d` de cada `<path>`). */
const ICON_PATHS = Object.freeze({
  trash: ['M2.5 4h11', 'M6.5 4V2.5h3V4', 'M4 4l.7 9.5h6.6L12 4', 'M6.75 6.75v4', 'M9.25 6.75v4'],
  chevronDown: ['M4 6l4 4 4-4'],
  starOutline: ['M8 1.9l1.85 3.85 4.2.55-3.07 2.92.78 4.17L8 11.37l-3.76 2.02.78-4.17L1.95 6.3l4.2-.55z'],
  help: ['M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M6.2 6.1a1.9 1.9 0 0 1 3.7.6c0 1.3-1.9 1.6-1.9 2.8', 'M8 11.6v.1'],
  backup: ['M8 2.5v7', 'M5 6.5l3 3 3-3', 'M2.5 10.5v2.5h11v-2.5'],
});

/** @typedef {keyof typeof ICON_PATHS} IconName */

/**
 * @param {IconName} name
 * @param {{filled?: boolean}} [options] `filled` rellena el trazo (p. ej. la estrella activa).
 * @returns {SVGSVGElement} Decorativo: el nombre accesible va en el control que lo contiene.
 */
export function icon(name, { filled = false } = {}) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', ICON_VIEWBOX);
  svg.setAttribute('class', `icon icon--${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const pathData of ICON_PATHS[name]) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', pathData);
    if (filled) path.setAttribute('class', 'icon__fill');
    svg.append(path);
  }
  return svg;
}
