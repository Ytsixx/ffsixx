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
 * FERRAMENTA: Glitch (Distorção Digital)
 * Simula artefatos de corrupção de sinal digital.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {number} options.strength  - Intensidade do efeito (1-50). Padrão: 10
 * @param {string} options.mode      - 'rgb' | 'scan' | 'full'. Padrão: 'rgb'
 */
export async function glitch(buffer, { strength = 10, mode = 'rgb' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(1, Math.min(50, strength));
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  let filter;
  switch (mode) {
    case 'rgb':
      // Separa e desloca os canais de cor (aberração cromática)
      filter = [
        `rgbashift=rh=${s}:bh=-${s}:rv=${Math.floor(s / 2)}:bv=-${Math.floor(s / 2)}`
      ].join(',');
      break;

    case 'scan':
      // Linhas horizontais de scan com noise
      filter = `noise=alls=${s * 2}:allf=t+u,lagfun=decay=0.9`;
      break;

    case 'full':
      // Combinação: aberração cromática + noise + leve distorção
      filter = [
        `rgbashift=rh=${s}:bh=-${s}`,
        `noise=alls=${Math.floor(s * 1.5)}:allf=t+u`
      ].join(',');
      break;

    default:
      throw new Error(`Modo '${mode}' inválido. Use: 'rgb', 'scan' ou 'full'.`);
  }

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    strength: s,
    mode,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'glitch'
  };
}