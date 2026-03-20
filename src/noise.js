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
 * FERRAMENTA: Noise (Granulado / Ruído)
 * Adiciona efeito de grão fotográfico ou ruído digital à imagem.
 *
 * @param {Buffer} buffer - Buffer da imagem original
 * @param {Object} options
 * @param {number} options.strength  - Intensidade do ruído (0-100). Padrão: 25
 * @param {string} options.type      - Tipo de ruído: 'film' | 'digital' | 'soft'. Padrão: 'film'
 * @param {boolean} options.color    - Se true, ruído colorido. Se false, monocromático. Padrão: false
 */
export async function noise(buffer, { strength = 25, type = 'film', color = false } = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  const safeStrength = Math.max(1, Math.min(100, strength));

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  let filterString = '';

  switch (type) {
    case 'film': {
      // Grão cinematográfico: noise + leve blur para suavizar, simulando película
      const allStrength = safeStrength;
      const flags = color ? 'a' : 'u'; // 'a' = all channels, 'u' = uniform (luma only)
      filterString = `noise=alls=${allStrength}:allf=${flags}+t`;
      break;
    }

    case 'digital': {
      // Ruído digital duro: sem suavização, partículas nítidas
      const flags = color ? 'a' : 'u';
      filterString = `noise=alls=${safeStrength}:allf=${flags}`;
      break;
    }

    case 'soft': {
      // Ruído suave: grão muito fino com blur para efeito "dreamy"
      const softStrength = Math.round(safeStrength * 0.6);
      const flags = color ? 'a' : 'u';
      filterString = [
        `noise=alls=${softStrength}:allf=${flags}`,
        'gblur=sigma=0.5'  // Blur leve para suavizar o grão
      ].join(',');
      break;
    }

    default:
      throw new Error(`Tipo de noise '${type}' não suportado. Use: 'film', 'digital' ou 'soft'.`);
  }

  command.videoFilters(filterString);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    strength: safeStrength,
    type,
    color,
    sizeKB: Math.round(resBuffer.length / 1024),
    effect: 'noise'
  };
}