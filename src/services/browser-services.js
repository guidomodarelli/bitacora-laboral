/**
 * Integraciones con APIs del navegador: portapapeles y persistencia del almacenamiento.
 */

/**
 * Copia texto al portapapeles. Usa `execCommand` como respaldo si la API moderna no está disponible.
 * @param {string} text
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (clipboardError) {
      console.warn('browser-services:copyToClipboard clipboard API failed, using execCommand fallback', clipboardError);
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.className = 'visually-hidden';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('browser-services:copyToClipboard failed: el navegador no permitió copiar');
}

/** @returns {Promise<boolean|null>} `null` si el navegador no informa el estado. */
export async function isStoragePersisted() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}

/** Pide al navegador que no borre los datos ante falta de espacio. */
export async function requestStoragePersistence() {
  if (!navigator.storage?.persist) return null;
  return navigator.storage.persist();
}
