/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Modern Formats ────────────────────────────────────────────────────
 * Conversão para formatos modernos: AVIF.
 * (WebP já existe em convert.js — aqui adicionamos AVIF e utilitários)
 *
 * @example
 * import { toAvif } from 'ffsixx';
 *
 * // AVIF ~50% menor que JPEG com mesma qualidade visual
 * const avif = await toAvif(buffer, { quality: 60 });
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

function _sizeKB(buf) { return Math.round(buf.length / 1024); }
function _tmp(ext) {
  return join(tmpdir(), `ffsixx_fmt_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}
async function _cleanup(...paths) {
  await Promise.allSettled(paths.map(p => unlink(p).catch(() => {})));
}

/**
 * Converte imagem para AVIF (AV1 Image File Format).
 * Compressão ~50% melhor que JPEG, ~30% melhor que WebP.
 *
 * ⚠️  Requer FFmpeg compilado com libaom-av1 ou libsvtav1.
 *     A maioria dos builds modernos já inclui.
 *
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {number} [options.quality=60]  - Qualidade (0=melhor, 63=pior). Padrão: 60
 * @param {number} [options.speed=6]     - Velocidade de encode (0=lento/melhor, 9=rápido). Padrão: 6
 * @param {boolean}[options.lossless=false]
 * @returns {Promise<{ buffer, sizeKB, originalSizeKB, savedPercent, quality, type }>}
 */
export async function toAvif(buffer, { quality = 60, speed = 6, lossless = false } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('toAvif: input deve ser Buffer.');

  const safeQ = Math.max(0, Math.min(63, quality));
  const safeS = Math.max(0, Math.min(9, speed));

  // AVIF precisa de arquivo intermediário (não funciona bem com pipes)
  const inPath  = _tmp('jpg');
  const outPath = _tmp('avif');

  await writeFile(inPath, buffer);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .outputOptions([
          '-vcodec libaom-av1',
          `-crf ${safeQ}`,
          `-cpu-used ${safeS}`,
          lossless ? '-lossless 1' : '',
          '-still-picture 1',  // modo imagem estática (mais eficiente)
          '-an'
        ].filter(Boolean))
        .format('avif')
        .output(outPath)
        .on('end', resolve)
        .on('error', async (err) => {
          // Fallback para libsvtav1 se libaom não disponível
          try {
            await new Promise((res2, rej2) => {
              ffmpeg(inPath)
                .outputOptions([
                  '-vcodec libsvtav1',
                  `-crf ${safeQ}`,
                  `-preset ${safeS}`,
                  '-an'
                ])
                .format('avif')
                .output(outPath)
                .on('end', res2)
                .on('error', rej2)
                .run();
            });
            resolve();
          } catch {
            reject(new Error(
              `toAvif: FFmpeg sem suporte a AVIF. Compile com --enable-libaom-av1 ou --enable-libsvtav1.\n` +
              `Erro original: ${err.message}`
            ));
          }
        })
        .run();
    });

    const buf = await readFile(outPath);
    const savedPercent = Math.max(0, Math.round((1 - buf.length / buffer.length) * 100));

    return {
      buffer: buf,
      sizeKB: _sizeKB(buf),
      originalSizeKB: _sizeKB(buffer),
      savedPercent,
      quality: safeQ,
      speed:   safeS,
      type:    'avif'
    };
  } finally {
    await _cleanup(inPath, outPath);
  }
}