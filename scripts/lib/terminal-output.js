/**
 * Helpers de salida en terminal: color si hay TTY y no está NO_COLOR; texto plano si no.
 */

const ANSI = Object.freeze({
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  cyan: '\u001b[36m',
});

const STATUS_SYMBOLS = Object.freeze({ done: '✔', skipped: '•', warning: '!', error: '✖' });
const STATUS_COLORS = Object.freeze({ done: 'green', skipped: 'dim', warning: 'yellow', error: 'red' });

/**
 * @param {NodeJS.WriteStream} stream
 * @param {NodeJS.ProcessEnv} environment
 */
export function supportsColor(stream, environment) {
  return Boolean(stream.isTTY) && !('NO_COLOR' in environment) && environment.TERM !== 'dumb';
}

/**
 * @param {{stream?: NodeJS.WriteStream, environment?: NodeJS.ProcessEnv}} [options]
 */
export function createTerminalOutput({ stream = process.stdout, environment = process.env } = {}) {
  const useColor = supportsColor(stream, environment);
  const paint = (colorName, text) => (useColor ? `${ANSI[colorName]}${text}${ANSI.reset}` : text);
  const write = (line = '') => stream.write(`${line}\n`);

  return {
    paint,
    /** @param {string} title @param {string} subtitle */
    banner(title, subtitle) {
      write();
      write(`  ${paint('bold', paint('cyan', title))}`);
      write(`  ${paint('dim', subtitle)}`);
      write();
    },
    /** @param {number} index @param {number} total @param {string} title */
    step(index, total, title) {
      write(`${paint('dim', `[${index}/${total}]`)} ${paint('bold', title)}`);
    },
    /** @param {'done'|'skipped'|'warning'|'error'} status @param {string} message */
    status(status, message) {
      write(`      ${paint(STATUS_COLORS[status], STATUS_SYMBOLS[status])} ${message}`);
    },
    /** @param {string[]} lines */
    box(lines) {
      const width = Math.max(...lines.map((line) => line.length)) + 2;
      const border = useColor ? '─' : '-';
      const side = useColor ? '│' : '|';
      const [topLeft, topRight, bottomLeft, bottomRight] = useColor ? ['╭', '╮', '╰', '╯'] : ['+', '+', '+', '+'];
      write();
      write(paint('green', `${topLeft}${border.repeat(width)}${topRight}`));
      for (const line of lines) write(`${paint('green', side)} ${line.padEnd(width - 1)}${paint('green', side)}`);
      write(paint('green', `${bottomLeft}${border.repeat(width)}${bottomRight}`));
      write();
    },
    /** @param {string} message */
    error(message) {
      write(`${paint('red', `${STATUS_SYMBOLS.error} ${message}`)}`);
    },
  };
}
