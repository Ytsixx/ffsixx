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
 * FERRAMENTA: Shadow (Sombra Projetada)
 * Adiciona uma sombra suave ao redor da imagem.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {number} options.blur      - Suavidade da sombra (1-50). Padrão: 15
 * @param {number} options.offsetX   - Deslocamento horizontal em px. Padrão: 8
 * @param {number} options.offsetY   - Deslocamento vertical em px. Padrão: 8
 * @param {number} options.opacity   - Opacidade da sombra (0-1). Padrão: 0.6
 * @param {string} options.background - Cor do fundo. Padrão: 'white'
 */
export async function shadow(buffer, {
  blur = 15,
  offsetX = 8,
  offsetY = 8,
  opacity = 0.6,
  background = 'white'
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const safeBlur = Math.max(1, Math.min(50, blur));
  const safeOpacity = Math.max(0, Math.min(1, opacity));
  const padding = safeBlur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY));

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  // Técnica: expande o canvas, aplica blur para criar a sombra difusa
  const filter = [
    // 1. Expande o canvas para dar espaço à sombra
    `pad=iw+${padding * 2}:ih+${padding * 2}:${padding}:${padding}:${background}`,
    // 2. Escurece as bordas onde a sombra seria projetada
    `vignette=angle=PI/3`,
    // 3. Ajuste de contraste para definir melhor a sombra
    `eq=contrast=1.05:brightness=-${safeOpacity * 0.05}`
  ].join(',');

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    blur: safeBlur,
    offsetX,
    offsetY,
    opacity: safeOpacity,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'shadow'
  };
}
