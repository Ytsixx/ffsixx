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
 * FERRAMENTA: Resize Cover (Atalho focado em preenchimento total)
 */
export default async function resizeCover(buffer, options = {}) {
  // Ajuste para aceitar tanto (buffer, {width, height}) quanto (buffer, width, height)
  let width, height;
  
  if (typeof options === 'object') {
    width = options.width || -1;
    height = options.height || -1;
  } else {
    // Caso alguém passe resizeCover(buffer, 500, 500)
    width = arguments[1] || -1;
    height = arguments[2] || -1;
  }

  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  if (width === -1 && height === -1) throw new Error('Defina ao menos largura ou altura');

  const inputStream = Readable.from(buffer);
  
  // No modo Cover, usamos a lógica de aumentar até preencher e depois cropar o excesso
  const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg')
    .videoFilters(filter);

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    width,
    height,
    mode: 'cover',
    sizeKB: Math.round(resBuffer.length / 1024)
  };
}