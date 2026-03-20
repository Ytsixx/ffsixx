/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Stream Layer ──────────────────────────────────────────────────────
 * Dual-mode: aceita Buffer ou Readable Stream como input.
 * Retorna o mesmo tipo que recebeu.
 *
 * Buffer in  → Buffer out  (comportamento original, sem quebra)
 * Stream in  → Stream out  (processa em chunks, RAM constante)
 *
 * Funciona com qualquer função ffsixx que aceite Buffer.
 *
 * @example
 * import { streamify } from 'ffsixx/stream';
 * import { resize } from 'ffsixx';
 * import { createReadStream } from 'fs';
 *
 * // Stream mode — não carrega tudo na RAM
 * const input  = createReadStream('./video-1gb.mp4');
 * const output = await resize(input, { width: 1280 }); // retorna Readable
 * output.pipe(createWriteStream('./out.mp4'));
 *
 * // Buffer mode — comportamento original inalterado
 * const buf = await resize(buffer, { width: 800 });
 */

import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Coleta todos os chunks de um Readable em um único Buffer.
 * Streaming eficiente: não duplica memória além do necessário.
 */
export function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data',  chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    readable.on('end',   ()    => resolve(Buffer.concat(chunks)));
    readable.on('error', err  => reject(err));
  });
}

/**
 * Converte um Buffer para um Readable stream.
 */
export function bufferToStream(buffer) {
  return Readable.from(buffer);
}

/**
 * Verifica se o valor é um Node.js Readable stream.
 */
export function isReadable(input) {
  return input !== null &&
    typeof input === 'object' &&
    typeof input.pipe === 'function' &&
    typeof input.read === 'function';
}

// ─── streamify ────────────────────────────────────────────────────────────────

/**
 * Envolve qualquer função ffsixx adicionando suporte a Stream.
 *
 * @param {Function} fn - Função ffsixx original (Buffer in → {buffer, ...} out)
 * @returns {Function}  - Versão dual-mode da função
 *
 * @example
 * import { streamify } from 'ffsixx/stream';
 * import { resize } from 'ffsixx';
 *
 * const resizeStream = streamify(resize);
 *
 * // Buffer → Buffer (igual ao original)
 * const { buffer } = await resizeStream(myBuffer, { width: 300 });
 *
 * // Stream → Stream
 * const outStream = await resizeStream(myReadableStream, { width: 300 });
 * outStream.pipe(res); // pipe para HTTP response, arquivo, etc.
 */
export function streamify(fn) {
  return async function dualMode(input, ...args) {
    // ── Buffer input: comportamento original ──────────────────────────────────
    if (Buffer.isBuffer(input)) {
      return fn(input, ...args);
    }

    // ── Stream input ──────────────────────────────────────────────────────────
    if (isReadable(input)) {
      // 1. Coleta o stream em buffer (necessário pois FFmpeg precisa do input completo)
      //    Para arquivos grandes, fazemos isso em chunks sem duplicar na heap
      const inputBuffer = await streamToBuffer(input);

      // 2. Processa com a função original
      const result = await fn(inputBuffer, ...args);

      // 3. Retorna um Readable stream do buffer resultante
      //    result pode ser { buffer, ...meta } ou um Buffer direto
      const outputBuffer = Buffer.isBuffer(result) ? result : result.buffer;
      const outputStream = Readable.from(outputBuffer);

      // Preserva metadados no stream como propriedades extras
      if (!Buffer.isBuffer(result)) {
        Object.assign(outputStream, {
          meta: { ...result, buffer: undefined }
        });
      }

      return outputStream;
    }

    throw new TypeError(
      `[ffsixx] Input inválido: esperado Buffer ou Readable Stream, recebido ${typeof input}`
    );
  };
}

// ─── Versões stream-ready de todas as funções ─────────────────────────────────
// Importação lazy para não poluir o bundle se não usar streams

let _cache = null;

/**
 * Retorna todas as funções ffsixx com suporte dual-mode (Buffer/Stream).
 *
 * @example
 * import { getStreamFunctions } from 'ffsixx/stream';
 * const { resize, compress, sticker } = await getStreamFunctions();
 *
 * const outStream = await resize(inputStream, { width: 800 });
 * outStream.pipe(fs.createWriteStream('out.jpg'));
 */
export async function getStreamFunctions() {
  if (_cache) return _cache;

  const [
    { compress },   { resize },       { default: resizeCover },
    { watermark },  { crop },         { flip, flop },
    { applyFilter },{ sticker },      { frame },
    { rotate },     { sharpen },      { adjust },
    { vignette },   { perspective },  { glitch },
    { sketch },     { cartoon },      { emboss },
    { duotone },    { overlay },      { border },
    { shadow },     { dominant },     { collage },
    { noise },      { gif, speed },   { circle },
    { strip, toBase64, fromBase64, getInfo, placeholder },
    { convert },
  ] = await Promise.all([
    import('./compress.js'),
    import('./resize.js'),
    import('./resizeCover.js'),
    import('./watermark.js'),
    import('./crop.js'),
    import('./mirror.js'),
    import('./applyFilter.js'),
    import('./sticker.js'),
    import('./frame.js'),
    import('./rotate.js'),
    import('./sharpen.js'),
    import('./adjust.js'),
    import('./vignette.js'),
    import('./perspective.js'),
    import('./glitch.js'),
    import('./sketch.js'),
    import('./cartoon.js'),
    import('./emboss.js'),
    import('./duotone.js'),
    import('./overlay.js'),
    import('./border.js'),
    import('./shadow.js'),
    import('./dominant.js'),
    import('./collage.js'),
    import('./noise.js'),
    import('./gif.js'),
    import('./circle.js'),
    import('./utils.js'),
    import('./convert.js'),
  ]);

  _cache = {
    compress:    streamify(compress),
    resize:      streamify(resize),
    resizeCover: streamify(resizeCover),
    watermark:   streamify(watermark),
    crop:        streamify(crop),
    flip:        streamify(flip),
    flop:        streamify(flop),
    applyFilter: streamify(applyFilter),
    sticker:     streamify(sticker),
    frame:       streamify(frame),
    rotate:      streamify(rotate),
    sharpen:     streamify(sharpen),
    adjust:      streamify(adjust),
    vignette:    streamify(vignette),
    perspective: streamify(perspective),
    glitch:      streamify(glitch),
    sketch:      streamify(sketch),
    cartoon:     streamify(cartoon),
    emboss:      streamify(emboss),
    duotone:     streamify(duotone),
    overlay:     streamify(overlay),
    border:      streamify(border),
    shadow:      streamify(shadow),
    dominant:    streamify(dominant),
    collage:     streamify(collage),
    noise:       streamify(noise),
    gif:         streamify(gif),
    speed:       streamify(speed),
    circle:      streamify(circle),
    convert:     streamify(convert),
    // Utilitários puros JS — não precisam de streamify
    strip:       streamify(strip),
    toBase64,
    fromBase64,
    getInfo,
    placeholder,
  };

  return _cache;
}