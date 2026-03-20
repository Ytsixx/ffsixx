/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx/stream ────────────────────────────────────────────────────────────
 * Export dedicado para uso com Node.js Streams.
 * Dual-mode: Buffer in/out (padrão) ou Stream in/out (baixo consumo de RAM).
 *
 * @example
 * import { resize, compress } from 'ffsixx/stream';
 * import { createReadStream, createWriteStream } from 'fs';
 *
 * // Stream pipeline — ideal para arquivos grandes
 * const input  = createReadStream('./foto-grande.jpg');
 * const output = await resize(input, { width: 800, fit: 'cover' });
 * output.pipe(createWriteStream('./resized.jpg'));
 *
 * // Acessar metadados do resultado
 * console.log(output.meta); // { width: 800, height: 600, sizeKB: 120, fit: 'cover' }
 *
 * @example
 * // Usar streamify em qualquer função customizada
 * import { streamify } from 'ffsixx/stream';
 * import { myCustomFn } from './my-fn.js';
 * const streamFn = streamify(myCustomFn);
 */

export { streamify, getStreamFunctions, streamToBuffer, bufferToStream, isReadable } from './src/stream.js';

// Re-exporta todas as funções já com suporte dual-mode
// Uso: import { resize, compress } from 'ffsixx/stream'
export async function* _lazyExports() {}

// Named exports diretos (lazy-loaded no primeiro uso)
let _fns = null;
async function _load() {
  if (!_fns) {
    const { getStreamFunctions } = await import('./src/stream.js');
    _fns = await getStreamFunctions();
  }
  return _fns;
}

// Proxy: cada named export carrega as funções apenas quando chamado
const handler = {
  get(_, prop) {
    if (prop === 'then' || prop === 'default') return undefined;
    return async (...args) => {
      const fns = await _load();
      if (typeof fns[prop] !== 'function') {
        throw new Error(`[ffsixx/stream] Função '${prop}' não encontrada.`);
      }
      return fns[prop](...args);
    };
  }
};

/**
 * Namespace com todas as funções stream-ready.
 *
 * @example
 * import stream from 'ffsixx/stream';
 * const out = await stream.resize(input, { width: 300 });
 */
export default new Proxy({}, handler);