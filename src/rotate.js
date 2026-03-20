/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

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
 * FERRAMENTA: Rotate (Rotacionar Imagem)
 * @param {Buffer} buffer - Buffer da imagem original
 * @param {Object} options - { angle, background, expand }
 * @param {number} options.angle - Ângulo em graus (0-360). Padrão: 90
 * @param {string} options.background - Cor do fundo ao expandir. Padrão: 'black'
 * @param {boolean} options.expand - Se true, expande o canvas para não cortar. Padrão: true
 */
export async function rotate(buffer, { angle = 90, background = 'black', expand = true } = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  // Normaliza o ângulo para o intervalo [0, 360)
  const normalizedAngle = ((angle % 360) + 360) % 360;

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  // Ângulos simples (90, 180, 270) usam 'transpose' — mais rápido e sem perdas de qualidade
  if (normalizedAngle === 90) {
    command.videoFilters('transpose=1'); // 90° horário
  } else if (normalizedAngle === 180) {
    command.videoFilters('transpose=1,transpose=1'); // 180°
  } else if (normalizedAngle === 270) {
    command.videoFilters('transpose=2'); // 90° anti-horário
  } else if (normalizedAngle === 0) {
    // Sem rotação: retorna o buffer original diretamente
    return {
      buffer,
      angle: 0,
      sizeKB: Math.round(buffer.length / 1024),
      type: 'rotated'
    };
  } else {
    // Ângulo livre: usa 'rotate' com expansão opcional do canvas
    const angleRad = (normalizedAngle * Math.PI) / 180;
    const filter = expand
      ? `rotate=${angleRad}:fillcolor=${background}:ow='hypot(iw,ih)':oh='hypot(iw,ih)'`
      : `rotate=${angleRad}:fillcolor=${background}`;
    command.videoFilters(filter);
  }

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    angle: normalizedAngle,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'rotated'
  };
}