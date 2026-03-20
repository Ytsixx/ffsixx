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
 * FERRAMENTA: Flip (Espelhar Horizontalmente)
 */
export async function flip(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg')
    .videoFilters('hflip'); // hflip = horizontal flip

  const resBuffer = await _execFFmpeg(inputStream, command);
  return { buffer: resBuffer, mode: 'horizontal', sizeKB: Math.round(resBuffer.length / 1024) };
}

/**
 * FERRAMENTA: Flop (Espelhar Verticalmente)
 */
export async function flop(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg')
    .videoFilters('vflip'); // vflip = vertical flip (flop)

  const resBuffer = await _execFFmpeg(inputStream, command);
  return { buffer: resBuffer, mode: 'vertical', sizeKB: Math.round(resBuffer.length / 1024) };
}