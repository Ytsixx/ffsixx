/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Animation ─────────────────────────────────────────────────────────
 * GIF avançado e WebP animado.
 *
 * @example
 * import { gifReverse, gifOptimize, imagesToGif, toAnimatedWebP } from 'ffsixx';
 *
 * // Inverter um GIF
 * const reversed = await gifReverse(gifBuffer);
 *
 * // Otimizar GIF (reduz tamanho até 70%)
 * const small = await gifOptimize(gifBuffer, { colors: 64 });
 *
 * // Criar GIF de uma sequência de fotos
 * const gif = await imagesToGif([img1, img2, img3], { fps: 8 });
 *
 * // WebP animado de alta qualidade (menor que GIF)
 * const webp = await toAnimatedWebP([img1, img2, img3], { fps: 12, quality: 85 });
 */

import ffmpeg from 'fluent-ffmpeg';
import { writeFile, unlink, readFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sizeKB(buf) { return Math.round(buf.length / 1024); }
function _tmp(ext) {
  return join(tmpdir(), `ffsixx_anim_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}

function _runCmd(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on('end', resolve)
       .on('error', err => reject(new Error(`[ffsixx/animation] ${err.message}`)))
       .run();
  });
}

async function _cleanup(...paths) {
  await Promise.allSettled(paths.map(p => unlink(p).catch(() => {})));
}

// ─── gifReverse ───────────────────────────────────────────────────────────────

/**
 * Inverte a ordem dos frames de um GIF.
 *
 * @param {Buffer} buffer - Buffer do GIF original
 * @returns {Promise<{ buffer, sizeKB, type }>}
 */
export async function gifReverse(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('gifReverse: input deve ser Buffer.');

  const inPath  = _tmp('gif');
  const outPath = _tmp('gif');

  await writeFile(inPath, buffer);

  try {
    await _runCmd(
      ffmpeg(inPath)
        .videoFilters('reverse')
        .format('gif')
        .output(outPath)
    );

    const buf = await readFile(outPath);
    return { buffer: buf, sizeKB: _sizeKB(buf), type: 'gif_reversed' };
  } finally {
    await _cleanup(inPath, outPath);
  }
}

// ─── gifOptimize ──────────────────────────────────────────────────────────────

/**
 * Otimiza um GIF reduzindo paleta de cores e aplicando dithering.
 * Pode reduzir até 70% do tamanho sem perda visual significativa.
 *
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {number} [options.colors=128]  - Número de cores na paleta (2-256). Padrão: 128
 * @param {boolean}[options.dither=true] - Aplicar dithering. Padrão: true
 * @param {number} [options.fps]         - Reduzir FPS (opcional, ex: 24→12 para economizar)
 * @returns {Promise<{ buffer, sizeKB, originalSizeKB, savedPercent, colors, type }>}
 */
export async function gifOptimize(buffer, { colors = 128, dither = true, fps = null } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('gifOptimize: input deve ser Buffer.');

  const safeColors = Math.max(2, Math.min(256, colors));
  const inPath  = _tmp('gif');
  const outPath = _tmp('gif');

  await writeFile(inPath, buffer);

  try {
    const filters = [];
    if (fps) filters.push(`fps=${fps}`);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inPath);

      if (dither) {
        cmd.complexFilter([
          filters.length
            ? `[0:v]${filters.join(',')},split[a][b]`
            : '[0:v]split[a][b]',
          `[a]palettegen=max_colors=${safeColors}:stats_mode=full[pal]`,
          '[b][pal]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
        ]);
      } else {
        if (filters.length) cmd.videoFilters(filters.join(','));
        cmd.outputOptions([`-vf palettegen=max_colors=${safeColors}`]);
      }

      cmd.format('gif').output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`gifOptimize: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    const savedPercent = Math.round((1 - buf.length / buffer.length) * 100);

    return {
      buffer: buf,
      sizeKB: _sizeKB(buf),
      originalSizeKB: _sizeKB(buffer),
      savedPercent: Math.max(0, savedPercent),
      colors: safeColors,
      type: 'gif_optimized'
    };
  } finally {
    await _cleanup(inPath, outPath);
  }
}

// ─── gifSpeed ─────────────────────────────────────────────────────────────────

/**
 * Altera a velocidade de um GIF animado.
 *
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {number} [options.factor=2] - Fator: 0.5=lento, 1=normal, 4=rápido
 * @returns {Promise<{ buffer, sizeKB, factor, type }>}
 */
export async function gifSpeed(buffer, { factor = 2 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('gifSpeed: input deve ser Buffer.');

  const sf = Math.max(0.1, Math.min(10, factor));
  const inPath  = _tmp('gif');
  const outPath = _tmp('gif');

  await writeFile(inPath, buffer);

  try {
    await _runCmd(
      ffmpeg(inPath)
        .videoFilters(`setpts=${(1 / sf).toFixed(4)}*PTS`)
        .format('gif')
        .output(outPath)
    );

    const buf = await readFile(outPath);
    return { buffer: buf, sizeKB: _sizeKB(buf), factor: sf, type: 'gif_speed' };
  } finally {
    await _cleanup(inPath, outPath);
  }
}

// ─── imagesToGif ──────────────────────────────────────────────────────────────

/**
 * Cria um GIF animado a partir de uma sequência de imagens (JPEG/PNG).
 * Mais flexível que gif() — aceita imagens de tamanhos diferentes e
 * suporta tempo de exibição por frame.
 *
 * @param {Buffer[]} images - Array de Buffers de imagem
 * @param {Object} [options]
 * @param {number}   [options.fps=8]         - Frames por segundo
 * @param {number}   [options.width=480]     - Largura do GIF
 * @param {number[]} [options.delays]        - Tempo em ms por frame [100, 200, 100, ...]
 * @param {number}   [options.loop=0]        - Loops (0 = infinito)
 * @param {boolean}  [options.dither=true]   - Dithering de qualidade
 * @param {string}   [options.fit='contain'] - 'cover' | 'contain' para frames de tamanhos diferentes
 * @returns {Promise<{ buffer, sizeKB, frames, fps, width, type }>}
 */
export async function imagesToGif(images, {
  fps = 8, width = 480, delays = null, loop = 0, dither = true, fit = 'contain'
} = {}) {
  if (!Array.isArray(images) || images.length < 2) {
    throw new Error('imagesToGif: forneça ao menos 2 imagens.');
  }
  if (!images.every(b => Buffer.isBuffer(b))) {
    throw new Error('imagesToGif: todos os itens devem ser Buffers.');
  }

  const safeFps = Math.max(1, Math.min(30, fps));
  const tmpFiles = [];

  try {
    // Salva cada imagem em arquivo temporário
    for (const img of images) {
      const p = _tmp('jpg');
      await writeFile(p, img);
      tmpFiles.push(p);
    }

    const outPath = _tmp('gif');
    tmpFiles.push(outPath);

    // Escala com altura par (necessário para GIF)
    const scaleFilter = fit === 'cover'
      ? `scale=${width}:${width}:force_original_aspect_ratio=increase,crop=${width}:${width}`
      : `scale=${width}:${width}:force_original_aspect_ratio=decrease,pad=${width}:${width}:(ow-iw)/2:(oh-ih)/2:white`;

    await new Promise((resolve, reject) => {
      // Usa múltiplos inputs diretos (mais compatível que concat demuxer no Termux)
      const cmd = ffmpeg();
      for (const f of tmpFiles.slice(0, -1)) { // exclui outPath
        cmd.input(f).inputOptions([`-framerate ${safeFps}`]);
      }

      // filter_complex para juntar todos os inputs
      const filterParts = [];
      const count = tmpFiles.length - 1; // nr de frames

      // Escala cada input
      for (let i = 0; i < count; i++) {
        filterParts.push(`[${i}:v]${scaleFilter}[f${i}]`);
      }

      // Concatena todos os frames
      const concatInputs = Array.from({ length: count }, (_, i) => `[f${i}]`).join('');
      filterParts.push(`${concatInputs}concat=n=${count}:v=1:a=0[concat]`);

      if (dither) {
        filterParts.push(`[concat]split[s0][s1]`);
        filterParts.push(`[s0]palettegen=max_colors=256:stats_mode=full[pal]`);
        filterParts.push(`[s1][pal]paletteuse=dither=bayer:bayer_scale=5[out]`);
      } else {
        filterParts.push(`[concat]copy[out]`);
      }

      cmd.complexFilter(filterParts, 'out')
        .outputOptions([`-loop ${loop}`])
        .format('gif')
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`imagesToGif: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    return {
      buffer: buf,
      sizeKB: _sizeKB(buf),
      frames: images.length,
      fps:    safeFps,
      width,
      type:   'images_to_gif'
    };

  } finally {
    await Promise.allSettled(tmpFiles.map(f => unlink(f).catch(() => {})));
  }
}

// ─── toAnimatedWebP ───────────────────────────────────────────────────────────

/**
 * Cria um WebP animado a partir de uma sequência de imagens.
 * Muito menor que GIF com a mesma qualidade visual.
 *
 * @param {Buffer[]} images
 * @param {Object} [options]
 * @param {number} [options.fps=12]      - Frames por segundo
 * @param {number} [options.width=480]   - Largura
 * @param {number} [options.quality=85]  - Qualidade (1-100). Padrão: 85
 * @param {number} [options.loop=0]      - Loops (0 = infinito)
 * @param {boolean}[options.lossless=false] - Modo sem perdas (maior arquivo)
 * @returns {Promise<{ buffer, sizeKB, frames, fps, quality, type }>}
 */
export async function toAnimatedWebP(images, {
  fps = 12, width = 480, quality = 85, loop = 0, lossless = false
} = {}) {
  if (!Array.isArray(images) || images.length < 2) {
    throw new Error('toAnimatedWebP: forneça ao menos 2 imagens.');
  }

  const safeFps  = Math.max(1, Math.min(60, fps));
  const tmpFiles = [];

  try {
    for (const img of images) {
      const p = _tmp('jpg');
      await writeFile(p, img);
      tmpFiles.push(p);
    }

    const listPath = _tmp('txt');
    const listContent = tmpFiles
      .map(f => `file '${f}'\nduration ${(1 / safeFps).toFixed(4)}`)
      .join('\n');
    await writeFile(listPath, listContent);
    tmpFiles.push(listPath);

    const outPath = _tmp('webp');
    tmpFiles.push(outPath);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .videoFilters(`scale=${width}:-1:flags=lanczos`)
        .outputOptions([
          '-vcodec libwebp',
          `-quality ${quality}`,
          lossless ? '-lossless 1' : '-lossless 0',
          `-loop ${loop}`,
          `-r ${safeFps}`,
          '-preset default',
          '-an' // sem áudio
        ])
        .format('webp')
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`toAnimatedWebP: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    return {
      buffer: buf,
      sizeKB: _sizeKB(buf),
      frames: images.length,
      fps:    safeFps,
      quality,
      lossless,
      type:   'animated_webp'
    };

  } finally {
    await Promise.allSettled(tmpFiles.map(f => unlink(f).catch(() => {})));
  }
}