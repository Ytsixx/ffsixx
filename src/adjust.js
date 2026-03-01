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
 * FERRAMENTA: Adjust (Brilho, Contraste & Saturação)
 * Usa o filtro 'eq' do FFmpeg — preciso e leve.
 *
 * @param {Buffer} buffer - Buffer da imagem original
 * @param {Object} options
 * @param {number} options.brightness  - Brilho. Range: -1.0 a 1.0. Padrão: 0 (sem mudança)
 * @param {number} options.contrast    - Contraste. Range: -1000 a 1000. Padrão: 1 (sem mudança)
 * @param {number} options.saturation  - Saturação. Range: 0 a 3. Padrão: 1 (sem mudança)
 * @param {number} options.gamma       - Gama. Range: 0.1 a 10. Padrão: 1 (sem mudança)
 */
export async function adjust(buffer, {
  brightness = 0,
  contrast = 1,
  saturation = 1,
  gamma = 1
} = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  // Clamp: garante que os valores estejam dentro dos limites do FFmpeg
  const safeBrightness  = Math.max(-1.0, Math.min(1.0, brightness));
  const safeContrast    = Math.max(-1000, Math.min(1000, contrast));
  const safeSaturation  = Math.max(0, Math.min(3.0, saturation));
  const safeGamma       = Math.max(0.1, Math.min(10.0, gamma));

  // Otimização: se todos os valores são "neutros", retorna o buffer sem processar
  if (safeBrightness === 0 && safeContrast === 1 && safeSaturation === 1 && safeGamma === 1) {
    return {
      buffer,
      sizeKB: Math.round(buffer.length / 1024),
      type: 'adjusted',
      info: 'no-op: valores neutros, imagem não processada'
    };
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  // O filtro 'eq' do FFmpeg agrupa todos os ajustes em um único passo — muito eficiente
  const filter = `eq=brightness=${safeBrightness}:contrast=${safeContrast}:saturation=${safeSaturation}:gamma=${safeGamma}`;
  command.videoFilters(filter);

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    brightness: safeBrightness,
    contrast: safeContrast,
    saturation: safeSaturation,
    gamma: safeGamma,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'adjusted'
  };
}
