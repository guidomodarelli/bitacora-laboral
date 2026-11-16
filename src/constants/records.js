/**
 * Vocabulario de actividades, resultados y enlaces.
 * @typedef {'work'|'meeting'|'research'|'decision'|'note'} ActivityKind
 * @typedef {'feature'|'bugfix'|'tests'|'research'|'docs'|'other'} ResultType
 * @typedef {'pr'|'ticket'|'doc'|'other'} LinkKind
 */

export const ACTIVITY_KIND = Object.freeze({
  WORK: 'work',
  MEETING: 'meeting',
  RESEARCH: 'research',
  DECISION: 'decision',
  NOTE: 'note',
});

/** @type {Readonly<Record<ActivityKind, string>>} */
export const ACTIVITY_KIND_LABELS = Object.freeze({
  work: 'Avance',
  meeting: 'Reunión',
  research: 'Investigación',
  decision: 'Decisión',
  note: 'Nota',
});

export const RESULT_TYPE = Object.freeze({
  FEATURE: 'feature',
  BUGFIX: 'bugfix',
  TESTS: 'tests',
  RESEARCH: 'research',
  DOCS: 'docs',
  OTHER: 'other',
});

/** @type {Readonly<Record<ResultType, string>>} */
export const RESULT_TYPE_LABELS = Object.freeze({
  feature: 'Funcionalidad',
  bugfix: 'Bug resuelto',
  tests: 'Tests / calidad',
  research: 'Investigación completada',
  docs: 'Documentación',
  other: 'Otro resultado',
});

export const LINK_KIND = Object.freeze({
  PR: 'pr',
  TICKET: 'ticket',
  DOC: 'doc',
  OTHER: 'other',
});

/** @type {Readonly<Record<LinkKind, string>>} */
export const LINK_KIND_LABELS = Object.freeze({
  pr: 'PR',
  ticket: 'Ticket',
  doc: 'Doc',
  other: 'Link',
});

/**
 * Reglas para inferir el tipo de enlace a partir de la URL. Se evalúan en orden.
 * @type {ReadonlyArray<{kind: LinkKind, pattern: RegExp}>}
 */
export const LINK_KIND_PATTERNS = Object.freeze([
  { kind: 'pr', pattern: /\/(pull|pulls|merge_requests|pull-requests)\/\d+/i },
  { kind: 'ticket', pattern: /atlassian\.net|jira|linear\.app|\/browse\/[a-z]+-\d+|\/issues\/\d+|trello\.com|clickup\.com/i },
  { kind: 'doc', pattern: /docs\.google|notion\.(so|site)|confluence|\/wiki|readme|\.md(?:[#?]|$)|\/docs?\//i },
]);

/** Protocolos permitidos al renderizar un enlace como `href`. */
export const SAFE_LINK_PROTOCOLS = Object.freeze(['http:', 'https:']);

/** Detecta URLs dentro de texto libre. */
export const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;
