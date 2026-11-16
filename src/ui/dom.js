/**
 * Helper mínimo para construir DOM sin innerHTML (evita inyección de HTML con texto del usuario).
 */

/** Propiedades que deben asignarse después de agregar los hijos (p. ej. `value` de un select). */
const PROPERTY_KEYS = new Set(['value', 'checked', 'selected', 'indeterminate']);
const EVENT_PREFIX = 'on';

/**
 * @param {Node} parent
 * @param {unknown[]} children
 */
function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/**
 * @param {string} tag
 * @param {Record<string, any>|null} [props]
 * @param {...unknown} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  const deferredProperties = [];
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith(EVENT_PREFIX) && typeof value === 'function') element.addEventListener(key.slice(EVENT_PREFIX.length).toLowerCase(), value);
    else if (PROPERTY_KEYS.has(key)) deferredProperties.push([key, value]);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  appendChildren(element, children);
  for (const [key, value] of deferredProperties) element[key] = value;
  return element;
}

/**
 * @param {Array<{value: string, label: string}>} options
 * @param {string} selectedValue
 */
export function optionElements(options, selectedValue) {
  return options.map((option) => h('option', { value: option.value, selected: option.value === selectedValue }, option.label));
}
