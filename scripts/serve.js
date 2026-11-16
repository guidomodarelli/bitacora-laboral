#!/usr/bin/env node
/**
 * Servidor estático mínimo para usar la bitácora en http://localhost.
 * Escucha solo en 127.0.0.1: no expone tus datos a la red. Sin dependencias.
 *
 * Uso: node scripts/serve.js   (puerto configurable con BITACORA_PORT)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTerminalOutput } from './lib/terminal-output.js';

const DEFAULT_PORT = 4173;
const LISTEN_HOST = '127.0.0.1';
const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REQUIRED_FILES = ['index.html', 'src/main.js', 'styles/app.css', 'sw.js'];
const EXIT_CODE_FAILURE = 1;

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
});

const output = createTerminalOutput();

/** @param {string} urlPath @returns {string|null} Ruta absoluta dentro del proyecto, o `null` si intenta salir. */
function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = normalize(decodedPath === '/' ? '/index.html' : decodedPath).replace(/^([/\\])+/, '');
  const absolutePath = resolve(PROJECT_ROOT, relativePath);
  return absolutePath === PROJECT_ROOT || absolutePath.startsWith(`${PROJECT_ROOT}${sep}`) ? absolutePath : null;
}

async function handleRequest(request, response) {
  let filePath;
  try {
    filePath = resolveRequestPath(request.url ?? '/');
  } catch {
    filePath = null;
  }
  if (!filePath || filePath.split(sep).includes('node_modules') || filePath.includes(`${sep}.`)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

async function main() {
  const port = Number(process.env.BITACORA_PORT ?? DEFAULT_PORT);
  output.banner('Bitácora laboral', 'Servidor local · tus datos quedan en el navegador');

  output.step(1, 2, 'Verificando archivos de la app');
  for (const requiredFile of REQUIRED_FILES) {
    try {
      await stat(join(PROJECT_ROOT, requiredFile));
    } catch {
      output.error(`Falta ${requiredFile}. Ejecutá el script desde el proyecto completo.`);
      process.exit(EXIT_CODE_FAILURE);
    }
  }
  output.status('done', `${REQUIRED_FILES.length} archivos encontrados`);

  output.step(2, 2, `Iniciando servidor en ${LISTEN_HOST}:${port}`);
  const server = createServer((request, response) => {
    handleRequest(request, response).catch((requestError) => {
      console.error(`serve:handleRequest failed (url=${String(request.url).slice(0, 120)})`, requestError);
      if (!response.headersSent) response.writeHead(500).end('Internal error');
    });
  });
  server.on('error', (serverError) => {
    const message = serverError.code === 'EADDRINUSE'
      ? `El puerto ${port} ya está en uso. Cerrá el otro proceso o usá BITACORA_PORT=<otro puerto>.`
      : `No se pudo iniciar el servidor: ${serverError.message}`;
    output.error(message);
    process.exit(EXIT_CODE_FAILURE);
  });
  server.listen(port, LISTEN_HOST, () => {
    output.status('done', 'Servidor escuchando solo en esta computadora');
    output.box([
      `Abrí:  http://localhost:${port}`,
      'Instalala como app desde el menú del navegador',
      'para usarla offline y en su propia ventana.',
      '',
      'Ctrl+C para detener.',
    ]);
  });
}

main();
