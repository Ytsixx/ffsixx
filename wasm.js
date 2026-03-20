/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx/wasm ──────────────────────────────────────────────────────────────
 * Entry point do export dedicado para uso explícito de WASM ou auto-detect.
 *
 * @example
 * // Auto-detect (tenta nativo, cai para WASM):
 * import { createFFsixx } from 'ffsixx/wasm';
 * const fx = await createFFsixx();
 * const result = await fx.resize(buffer, { width: 300 });
 *
 * @example
 * // Forçar WASM (útil em browser, Vercel, Cloudflare, Deno, Bun):
 * const fx = await createFFsixx({ useWasm: true });
 * const sticker = await fx.sticker(buffer);
 *
 * @example
 * // Verificar qual engine está ativo:
 * const fx = await createFFsixx();
 * console.log(fx.engine); // → 'native' | 'wasm'
 */

import { hasNativeFFmpeg, getEngineMode } from './src/engine.js';

// ─── Imports nativos (fluent-ffmpeg) ─────────────────────────────────────────

async function _loadNative() {
  const [
    { compress },    { resize },       { default: resizeCover },
    { watermark },   { crop },         { flip, flop },
    { applyFilter }, { sticker },      { frame },
    { rotate },      { sharpen },      { adjust },
    { vignette },    { perspective },  { glitch },
    { sketch },      { cartoon },      { emboss },
    { duotone },     { overlay },      { border },
    { shadow },      { dominant },     { collage },
    { noise },       { gif, speed },   { circle },
    { strip, toBase64, fromBase64, getInfo, placeholder },
  ] = await Promise.all([
    import('./src/compress.js'),
    import('./src/resize.js'),
    import('./src/resizeCover.js'),
    import('./src/watermark.js'),
    import('./src/crop.js'),
    import('./src/mirror.js'),
    import('./src/applyFilter.js'),
    import('./src/sticker.js'),
    import('./src/frame.js'),
    import('./src/rotate.js'),
    import('./src/sharpen.js'),
    import('./src/adjust.js'),
    import('./src/vignette.js'),
    import('./src/perspective.js'),
    import('./src/glitch.js'),
    import('./src/sketch.js'),
    import('./src/cartoon.js'),
    import('./src/emboss.js'),
    import('./src/duotone.js'),
    import('./src/overlay.js'),
    import('./src/border.js'),
    import('./src/shadow.js'),
    import('./src/dominant.js'),
    import('./src/collage.js'),
    import('./src/noise.js'),
    import('./src/gif.js'),
    import('./src/circle.js'),
    import('./src/utils.js'),
  ]);

  return {
    compress, resize, resizeCover, watermark, crop,
    flip, flop, applyFilter, sticker, frame,
    rotate, sharpen, adjust, vignette, perspective,
    glitch, sketch, cartoon, emboss, duotone,
    overlay, border, shadow,
    dominant, collage, noise, circle,
    strip, toBase64, fromBase64, getInfo, placeholder,
    gif, speed,
  };
}

// ─── Imports WASM ─────────────────────────────────────────────────────────────

async function _loadWasm() {
  return import('./src/wasm-adapter.js');
}

// ─── createFFsixx ─────────────────────────────────────────────────────────────

/**
 * Cria uma instância ffsixx com o engine apropriado.
 *
 * @param {Object}  [options]
 * @param {boolean} [options.useWasm=false]  - Força o uso de WASM, mesmo com FFmpeg nativo disponível.
 * @param {boolean} [options.silent=false]   - Suprime o aviso de fallback no console.
 * @returns {Promise<Object>} Instância com todas as funções + propriedade `.engine`
 */
export async function createFFsixx({ useWasm = false, silent = false } = {}) {
  let engine;
  let fns;

  if (useWasm) {
    // Modo explícito: sempre WASM
    engine = 'wasm';
    fns = await _loadWasm();
  } else {
    // Auto-detect
    const native = await hasNativeFFmpeg();
    if (native) {
      engine = 'native';
      fns = await _loadNative();
    } else {
      engine = 'wasm';
      if (!silent) {
        console.warn(
          '[ffsixx] FFmpeg nativo não encontrado. Usando @ffmpeg/ffmpeg (WASM) como fallback.\n' +
          '         Para suprimir este aviso: createFFsixx({ silent: true })'
        );
      }
      fns = await _loadWasm();
    }
  }

  return { ...fns, engine };
}

// ─── Exports adicionais de utilidade ─────────────────────────────────────────

export { hasNativeFFmpeg, getEngineMode } from './src/engine.js';

/**
 * Atalho: verifica qual engine seria usado sem criar a instância completa.
 * @returns {Promise<'native'|'wasm'>}
 */
export async function detectEngine() {
  return getEngineMode();
}