import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.OFFLINE_PORT || '4173');
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; media-src 'self' blob: data:; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob:; frame-src 'self'; form-action 'none'; object-src 'none'; base-uri 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.otf': 'font/otf', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2',
  '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.hdr': 'image/vnd.radiance',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
};
const finish = (response, status, message) => { response.writeHead(status, headers); response.end(message); };

createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) return finish(response, 405, 'Local exhibit');
    const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (path.startsWith('/__local/')) return finish(response, 410, 'Local exhibit');
    const file = resolve(base, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(base + sep)) return finish(response, 403, 'File outside exhibit');
    const info = await stat(file);
    if (!info.isFile()) return finish(response, 404, 'File unavailable');
    const options = {
      ...headers,
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) return finish(response, 416, 'Range unavailable');
      response.writeHead(206, { ...options, 'Content-Length': end - start + 1, 'Content-Range': 'bytes ' + start + '-' + end + '/' + info.size });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file, { start, end }).pipe(response);
    } else {
      response.writeHead(200, { ...options, 'Content-Length': info.size });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).pipe(response);
    }
  } catch {
    finish(response, 404, 'File unavailable');
  }
}).listen(port, '127.0.0.1', () => process.stdout.write('OFFLINE local preview at http://127.0.0.1:' + port + '/\n'));
