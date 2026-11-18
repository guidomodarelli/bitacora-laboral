/**
 * Avisos breves no bloqueantes, con acción opcional (p. ej. «Deshacer»).
 *
 * El aviso visible no es una región viva: el texto se anuncia una sola vez en una
 * región oculta (cortés para info y éxito, inmediata para errores). El aviso se
 * pausa mientras el puntero o el foco están sobre él, para poder leerlo o usar su acción.
 */
import { TOAST_DURATION_MS, TOAST_WITH_ACTION_DURATION_MS } from '../constants/timing.js';
import { h } from './dom.js';

const POLITE_REGION_ID = 'announce-polite';
const ASSERTIVE_REGION_ID = 'announce-assertive';

/**
 * Reemplaza el texto de la región para que el lector de pantalla lo lea aunque se repita.
 * @param {string} message
 * @param {boolean} isUrgent
 */
function announce(message, isUrgent) {
  const region = document.getElementById(isUrgent ? ASSERTIVE_REGION_ID : POLITE_REGION_ID);
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}

/**
 * @param {string} message
 * @param {{tone?: 'info'|'success'|'error', actionLabel?: string, onAction?: () => void}} [options]
 */
export function showToast(message, { tone = 'info', actionLabel, onAction } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = h('div', { class: `toast toast--${tone}` }, h('span', {}, message));
  const durationMs = actionLabel ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS;
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let dismissTimer;
  const dismiss = () => {
    clearTimeout(dismissTimer);
    toast.remove();
  };
  const scheduleDismiss = () => {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(dismiss, durationMs);
  };
  if (actionLabel && onAction) {
    toast.append(h('button', { type: 'button', class: 'toast__action', onClick: () => { dismiss(); onAction(); } }, actionLabel));
  }
  toast.append(h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Cerrar aviso', onClick: dismiss }, '×'));
  toast.addEventListener('pointerenter', () => clearTimeout(dismissTimer));
  toast.addEventListener('pointerleave', () => { if (!toast.contains(document.activeElement)) scheduleDismiss(); });
  toast.addEventListener('focusin', () => clearTimeout(dismissTimer));
  toast.addEventListener('focusout', (event) => { if (!toast.contains(/** @type {Node|null} */ (event.relatedTarget))) scheduleDismiss(); });
  region.append(toast);
  announce(actionLabel ? `${message}. ${actionLabel} disponible.` : message, tone === 'error');
  scheduleDismiss();
}
