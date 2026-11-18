/**
 * Shell de la aplicación: navegación por hash, re-render ante cambios y atajos de teclado.
 */
import { DEFAULT_ROUTE, NAVIGATION_ITEMS, QUICK_CAPTURE_SHORTCUT_KEY, RERENDER_EVENT, ROUTE, buildRouteHash } from '../constants/routes.js';
import { getSnapshot, subscribe } from '../services/data-store.js';
import { h } from './dom.js';
import { backupIndicator, shortcutsHelp } from './header-tools.js';
import { renderDailyView } from './views/daily-view.js';
import { renderHistoryView } from './views/history-view.js';
import { renderMonthlyView, renderWeeklyView } from './views/period-views.js';
import { renderSettingsView } from './views/settings-view.js';
import { renderTasksView } from './views/tasks-view.js';
import { renderTodayView } from './views/today-view.js';

const VIEW_RENDERERS = Object.freeze({
  [ROUTE.TODAY]: renderTodayView,
  [ROUTE.DAILY]: renderDailyView,
  [ROUTE.TASKS]: renderTasksView,
  [ROUTE.HISTORY]: renderHistoryView,
  [ROUTE.WEEKLY]: renderWeeklyView,
  [ROUTE.MONTHLY]: renderMonthlyView,
  [ROUTE.SETTINGS]: renderSettingsView,
});

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function parseRoute() {
  const [routeSegment = '', paramSegment] = window.location.hash.replace(/^#\/?/, '').split('/');
  const route = routeSegment in VIEW_RENDERERS ? routeSegment : DEFAULT_ROUTE;
  return { route, param: paramSegment ? decodeURIComponent(paramSegment) : null };
}

/**
 * Guarda foco, selección, scroll y `<details>` abiertos para que un re-render no interrumpa al usuario.
 * @param {HTMLElement} container
 */
function captureViewState(container) {
  const active = /** @type {HTMLInputElement|null} */ (document.activeElement);
  const focusKey = active && container.contains(active) ? active.dataset.focusKey : undefined;
  let selection = null;
  try {
    if (focusKey && typeof active.selectionStart === 'number') selection = [active.selectionStart, active.selectionEnd];
  } catch {
    selection = null;
  }
  return {
    focusKey,
    selection,
    scrollY: window.scrollY,
    openDetails: [...container.querySelectorAll('details')].map((details) => details.open),
  };
}

/**
 * @param {HTMLElement} container
 * @param {ReturnType<typeof captureViewState>} state
 */
function restoreViewState(container, state) {
  const detailsElements = [...container.querySelectorAll('details')];
  if (detailsElements.length === state.openDetails.length) detailsElements.forEach((details, index) => { details.open = state.openDetails[index]; });
  if (state.focusKey) {
    const target = /** @type {HTMLInputElement|null} */ (container.querySelector(`[data-focus-key="${CSS.escape(state.focusKey)}"]`));
    if (target) {
      target.focus({ preventScroll: true });
      if (state.selection) {
        try {
          target.setSelectionRange(state.selection[0], state.selection[1]);
        } catch {
          // Algunos tipos de input (date, number) no admiten selección.
        }
      }
    }
  }
  window.scrollTo(0, state.scrollY);
}

/** @param {HTMLElement} root */
export function startApp(root) {
  const navigationLinks = NAVIGATION_ITEMS.map((item) => h('a', { href: buildRouteHash(item.route), class: 'nav-link', title: `Alt+${item.shortcut}`, 'aria-keyshortcuts': `Alt+${item.shortcut}` }, item.label));
  const backupSlot = h('div', { class: 'header-tools__backup' });
  const main = h('main', { id: 'view', tabindex: '-1' });
  root.replaceChildren(
    h('header', { class: 'app-header' },
      h('a', { href: buildRouteHash(ROUTE.TODAY), class: 'app-brand' }, 'Bitácora'),
      h('nav', { class: 'app-nav', 'aria-label': 'Secciones' }, navigationLinks),
      h('div', { class: 'header-tools' }, backupSlot, shortcutsHelp()),
    ),
    main,
  );

  let renderedRoute = null;
  const render = () => {
    const { route, param } = parseRoute();
    const routeKey = `${route}/${param ?? ''}`;
    const state = routeKey === renderedRoute ? captureViewState(main) : null;
    const snapshot = getSnapshot();
    const view = VIEW_RENDERERS[route]({ snapshot, param });
    backupSlot.replaceChildren(backupIndicator(snapshot) ?? '');
    // La animación de entrada solo al navegar, no en cada actualización de datos.
    if (!state) view.classList.add('view--enter');
    main.replaceChildren(view);
    NAVIGATION_ITEMS.forEach((item, index) => {
      if (item.route === route) {
        navigationLinks[index].setAttribute('aria-current', 'page');
        // En pantallas angostas la navegación se desplaza: la sección activa siempre queda a la vista.
        if (!state) navigationLinks[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      else navigationLinks[index].removeAttribute('aria-current');
    });
    if (state) restoreViewState(main, state);
    else window.scrollTo(0, 0);
    renderedRoute = routeKey;
  };

  window.addEventListener('hashchange', render);
  window.addEventListener(RERENDER_EVENT, render);
  subscribe(render);

  document.addEventListener('keydown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const isTyping = EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const item = NAVIGATION_ITEMS.find((candidate) => candidate.shortcut === event.key);
      if (item) {
        event.preventDefault();
        window.location.hash = buildRouteHash(item.route);
      }
      return;
    }
    if (!isTyping && event.key === QUICK_CAPTURE_SHORTCUT_KEY) {
      event.preventDefault();
      if (parseRoute().route !== ROUTE.TODAY) window.location.hash = buildRouteHash(ROUTE.TODAY);
      requestAnimationFrame(() => document.getElementById('quick-capture-input')?.focus());
    }
  });

  render();
}
