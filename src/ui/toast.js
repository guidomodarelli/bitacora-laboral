/**
 * Avisos breves no bloqueantes, con acción opcional (p. ej. «Deshacer»).
 */
import { TOAST_DURATION_MS, TOAST_WITH_ACTION_DURATION_MS } from '../constants/timing.js';
import { h } from './dom.js';

/**
 * @param {string} message
 * @param {{tone?: 'info'|'success'|'error', actionLabel?: string, onAction?: () => void}} [options]
 */
export function showToast(message, { tone = 'info', actionLabel, onAction } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = h('div', { class: `toast toast--${tone}`, role: tone === 'error' ? 'alert' : null }, h('span', {}, message));
  const dismiss = () => toast.remove();
  if (actionLabel && onAction) {
    toast.append(h('button', { type: 'button', class: 'toast__action', onClick: () => { dismiss(); onAction(); } }, actionLabel));
  }
  toast.append(h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Cerrar aviso', onClick: dismiss }, '×'));
  region.append(toast);
  setTimeout(dismiss, actionLabel ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS);
}
