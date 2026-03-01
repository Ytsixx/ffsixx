import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';

function _execFFmpeg(inputStream, command) {
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
 * FERRAMENTA: Sharpen (Nitidez / Desfoque)
 * Usa o filtro 'unsharp' do FFmpeg — o mais poderoso para nitidez.
 *
 * @param {Buffer} buffer - Buffer da imagem original
 * @param {Object} options
 * @param {number} options.strength  - Intensidade do efeito. Positivo = nitidez, Negativo = blur. Padrão: 1.5
 * @param {number} options.radius    - Tamanho da área de efeito (deve ser ímpar, 3-23). Padrão: 5
 * @param {string} options.mode      - 'sharpen' | 'blur' | 'unsharp'. Padrão: 'sharpen'
 */
export async function sharpen(buffer, { strength = 1.5, radius = 5, mode = 'sharpen' } = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  // Garante que o radius seja ímpar e dentro do range do FFmpeg (3-23)
  const safeRadius = Math.max(3, Math.min(23, radius % 2 === 0 ? radius + 1 : radius));

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  let filter = '';

  switch (mode) {
    case 'blur':
      // Gaussian blur suave
      filter = `gblur=sigma=${Math.abs(strength) * 2}`;
      break;

    case 'sharpen':
    case 'unsharp':
    default: {
      // unsharp=lx:ly:la:cx:cy:ca
      // lx/ly = tamanho do kernel de luminância
      // la    = força (positivo = nitidez, negativo = blur)
      // cx/cy = kernel de croma (cor)
      // ca    = força do croma
      const lumaStrength = mode === 'blur' ? -Math.abs(strength) : strength;
      filter = `unsharp=${safeRadius}:${safeRadius}:${lumaStrength}:${safeRadius}:${safeRadius}:0`;
      break;
    }
  }

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    mode,
    strength,
    radius: safeRadius,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'sharpened'
  };
}
