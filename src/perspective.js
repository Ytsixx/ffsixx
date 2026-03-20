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
 * FERRAMENTA: Perspective (Distorção de Perspectiva)
 * Aplica uma distorção trapezoidal simulando profundidade.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string} options.direction - 'left' | 'right' | 'top' | 'bottom'. Padrão: 'right'
 * @param {number} options.strength  - Intensidade da distorção (0-100). Padrão: 30
 */
export async function perspective(buffer, { direction = 'right', strength = 30 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(0, Math.min(100, strength)) / 100;

  // perspective filter: x0y0:x1y0:x0y1:x1y1 (normalizado 0-1)
  // Cada par representa um canto: topo-esquerdo, topo-direito, baixo-esquerdo, baixo-direito
  let perspectiveCoords;
  switch (direction) {
    case 'left':
      perspectiveCoords = `${s}:${s}:1-${s}:0:${s}:1-${s}:1-${s}:1`;
      break;
    case 'right':
      perspectiveCoords = `0:0:1-${s}:${s}:0:1:1-${s}:1-${s}`;
      break;
    case 'top':
      perspectiveCoords = `${s}:0:1-${s}:0:0:1:1:1`;
      break;
    case 'bottom':
      perspectiveCoords = `0:0:1:0:${s}:1:1-${s}:1`;
      break;
    default:
      throw new Error(`Direção '${direction}' inválida. Use: 'left', 'right', 'top' ou 'bottom'.`);
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(`perspective=${perspectiveCoords}:interpolation=linear`)
    .format('mjpeg');

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    direction,
    strength: Math.round(s * 100),
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'perspective'
  };
}