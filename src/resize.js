/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';

/**
 * MOTOR INTERNO (Privado)
 */
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
 * FERRAMENTA: Redimensionar (Versão Turbo)
 * @param {Buffer} buffer - Imagem original
 * @param {Object} options - { width, height, fit, background, upscale }
 */
export async function resize(buffer, options = {}) {
  // Ajuste para aceitar o objeto de opções do teste
  const { 
    width = -1, 
    height = -1, 
    fit = 'cover', 
    background = 'black', 
    upscale = false 
  } = options;

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  const specs = sizeOf(buffer);
  
  // 1. Lógica Anti-Upscale
  if (!upscale) {
    const isLarger = (width > specs.width && width !== -1) || (height > specs.height && height !== -1);
    if (isLarger) {
      return {
        buffer,
        width: specs.width,
        height: specs.height,
        sizeKB: Math.round(buffer.length / 1024),
        info: 'anti-upscale applied'
      };
    }
  }

  // 2. Configuração de Filtros (Cover vs Contain vs Fill)
  let filter = '';
  if (fit === 'cover') {
    filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  } else if (fit === 'contain') {
    filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${background}`;
  } else {
    filter = `scale=${width}:${height}`; // modo fill/distort
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filter)
    .format('mjpeg');

  // 3. Execução e Retorno do Objeto
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    width: width === -1 ? specs.width : width,
    height: height === -1 ? specs.height : height,
    sizeKB: Math.round(resBuffer.length / 1024),
    fit
  };
}