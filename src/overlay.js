import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

function _execFFmpeg(command) {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];
    outputStream.on('data', chunk => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', err => { command.kill(); reject(err); });
    command.on('error', err => { command.kill(); reject(err); }).pipe(outputStream, { end: true });
  });
}

/**
 * FERRAMENTA: Overlay (Sobrepor Duas Imagens)
 * Combina duas imagens com controle de opacidade e posição.
 *
 * @param {Buffer} base      - Imagem de fundo
 * @param {Buffer} over      - Imagem a sobrepor
 * @param {Object} options
 * @param {number} options.opacity   - Opacidade da imagem sobreposta (0-1). Padrão: 1
 * @param {string} options.position  - 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'. Padrão: 'center'
 * @param {number} options.x         - Posição X manual (sobrescreve position)
 * @param {number} options.y         - Posição Y manual (sobrescreve position)
 * @param {number} options.scale     - Escala da imagem superior (0.1-2.0). Padrão: 1
 */
export async function overlay(base, over, {
  opacity = 1,
  position = 'center',
  x = null,
  y = null,
  scale = 1
} = {}) {
  if (!Buffer.isBuffer(base) || !Buffer.isBuffer(over)) {
    throw new Error('base e over devem ser Buffers válidos.');
  }

  const safeOpacity = Math.max(0, Math.min(1, opacity));
  const safeScale = Math.max(0.1, Math.min(2.0, scale));

  const posMap = {
    'center':       '(main_w-overlay_w)/2:(main_h-overlay_h)/2',
    'top-left':     '10:10',
    'top-right':    'main_w-overlay_w-10:10',
    'bottom-left':  '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10'
  };

  const posStr = (x !== null && y !== null)
    ? `${x}:${y}`
    : (posMap[position] || posMap['center']);

  const tmpBase = join(tmpdir(), `ffsixx_overlay_base_${Date.now()}.jpg`);
  const tmpOver = join(tmpdir(), `ffsixx_overlay_over_${Date.now()}.png`);

  try {
    await writeFile(tmpBase, base);
    await writeFile(tmpOver, over);

    const command = ffmpeg()
      .input(tmpBase)
      .input(tmpOver);

    const scaleFilter = safeScale !== 1
      ? `[1:v]scale=iw*${safeScale}:ih*${safeScale}[scaled];[scaled]`
      : '[1:v]';

    command.complexFilter([
      `${scaleFilter}format=rgba,colorchannelmixer=aa=${safeOpacity}[top]`,
      `[0:v][top]overlay=${posStr}[out]`
    ], 'out')
    .format('mjpeg')
    .outputOptions(['-frames:v 1']);

    const resBuffer = await _execFFmpeg(command);

    return {
      buffer: resBuffer,
      opacity: safeOpacity,
      position: (x !== null && y !== null) ? `custom(${x},${y})` : position,
      scale: safeScale,
      sizeKB: Math.round(resBuffer.length / 1024),
      type: 'overlay'
    };
  } finally {
    await Promise.allSettled([unlink(tmpBase), unlink(tmpOver)]);
  }
}
