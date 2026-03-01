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
 * FERRAMENTA: gif — Cria GIF animado a partir de um array de frames (Buffers)
 *
 * @param {Buffer[]} frames  - Array de buffers de imagem (frames do GIF)
 * @param {Object}   options
 * @param {number}   options.fps       - Frames por segundo. Padrão: 10
 * @param {number}   options.width     - Largura do GIF (-1 = automático). Padrão: 480
 * @param {number}   options.loop      - Número de loops (0 = infinito). Padrão: 0
 * @param {boolean}  options.dither    - Aplica dithering para melhor qualidade. Padrão: true
 */
export async function gif(frames, {
  fps = 10,
  width = 480,
  loop = 0,
  dither = true
} = {}) {
  if (!Array.isArray(frames) || frames.length < 2) {
    throw new Error('gif() requer um array com pelo menos 2 frames.');
  }
  if (!frames.every(f => Buffer.isBuffer(f))) {
    throw new Error('Todos os frames devem ser Buffers válidos.');
  }

  const safeFps = Math.max(1, Math.min(30, fps));
  const safeWidth = width === -1 ? -1 : Math.max(64, Math.min(1920, width));

  const tmpFiles = [];
  try {
    // 1. Salva cada frame em arquivo temporário
    for (let i = 0; i < frames.length; i++) {
      const tmpPath = join(tmpdir(), `ffsixx_gif_${Date.now()}_${String(i).padStart(4, '0')}.jpg`);
      await writeFile(tmpPath, frames[i]);
      tmpFiles.push(tmpPath);
    }

    // 2. Usa o primeiro frame como input com concat demuxer via lista
    const listPath = join(tmpdir(), `ffsixx_gif_list_${Date.now()}.txt`);
    const listContent = tmpFiles.map(f => `file '${f}'\nduration ${1 / safeFps}`).join('\n');
    await writeFile(listPath, listContent);
    tmpFiles.push(listPath);

    const command = ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0']);

    // 3. Paleta otimizada para GIF de qualidade
    if (dither) {
      command.complexFilter([
        `scale=${safeWidth}:-1:flags=lanczos,split[s0][s1]`,
        `[s0]palettegen=max_colors=256:stats_mode=full[palette]`,
        `[s1][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
      ]);
    } else {
      command.videoFilters(`scale=${safeWidth}:-1:flags=lanczos`);
    }

    command
      .format('gif')
      .outputOptions([`-loop ${loop}`, `-r ${safeFps}`]);

    const resBuffer = await _execFFmpeg(command);

    return {
      buffer: resBuffer,
      frames: frames.length,
      fps: safeFps,
      width: safeWidth,
      loop,
      sizeKB: Math.round(resBuffer.length / 1024),
      format: 'gif',
      type: 'animated'
    };
  } finally {
    await Promise.allSettled(tmpFiles.map(f => unlink(f)));
  }
}

/**
 * FERRAMENTA: speed — Acelera ou desacelera um GIF animado
 *
 * @param {Buffer} buffer    - Buffer do GIF original
 * @param {Object} options
 * @param {number} options.factor - Fator de velocidade (0.25=lento, 1=normal, 4=rápido). Padrão: 2
 */
export async function speed(buffer, { factor = 2 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const safeFactor = Math.max(0.1, Math.min(10, factor));
  const tmpIn = join(tmpdir(), `ffsixx_speed_in_${Date.now()}.gif`);
  const tmpFiles = [tmpIn];

  try {
    await writeFile(tmpIn, buffer);

    const command = ffmpeg()
      .input(tmpIn)
      // setpts controla a velocidade: 1/factor = mais rápido, factor = mais lento
      .videoFilters(`setpts=${(1 / safeFactor).toFixed(4)}*PTS`)
      .format('gif');

    const resBuffer = await _execFFmpeg(command);

    return {
      buffer: resBuffer,
      factor: safeFactor,
      sizeKB: Math.round(resBuffer.length / 1024),
      format: 'gif',
      type: 'speed'
    };
  } finally {
    await Promise.allSettled(tmpFiles.map(f => unlink(f)));
  }
}
