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
 * FERRAMENTA: Vignette (Escurecimento nas Bordas)
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {number} options.angle    - Ângulo do efeito em graus (0-90). Padrão: 20
 * @param {number} options.strength - Intensidade (0.1-1.0). Padrão: 0.5
 */
export async function vignette(buffer, { angle = 20, strength = 0.5 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const safeAngle = Math.max(0, Math.min(90, angle));
  const safeStrength = Math.max(0.1, Math.min(1.0, strength));
  const angleRad = (safeAngle * Math.PI) / 180;

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(`vignette=angle=${angleRad}:mode=forward:eval=init,colorbalance=rs=-${safeStrength * 0.1}:gs=-${safeStrength * 0.1}:bs=-${safeStrength * 0.1}`)
    .format('mjpeg');

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    angle: safeAngle,
    strength: safeStrength,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'vignette'
  };
}
