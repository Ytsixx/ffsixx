/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';
import { readFile, writeFile } from 'fs/promises';

/**
 * MOTOR INTERNO: O coração da lib. 
 * Ele conecta o FFmpeg ao sistema de Streams do Node.js. 
 */
function _execFFmpeg(inputStream, command) {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on('data', (chunk) => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', (err) => {
      command.kill();
      reject(new Error(`Erro no stream de saída: ${err.message}`));
    });

    command
      .on('error', (err) => {
        command.kill();
        reject(new Error(`Erro no FFmpeg: ${err.message}`));
      })
      .pipe(outputStream, { end: true });
  });
}

/**
 * FERRAMENTA TURBO: Converte imagem com inteligência de metadados.
 */
export async function convert(buffer, { format = 'webp', quality = 80 } = {}) {
  // 1. Verificação rápida de formato atual (image-size)
  const specs = sizeOf(buffer);
  
  if (specs.type === format && quality === 100) {
    return buffer; 
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format(format);

  // 2. Ajuste fino de qualidade por formato
  if (format === 'webp') {
    command.outputOptions([`-quality ${quality}`, '-lossless 0']);
  } else if (format === 'jpeg' || format === 'jpg') {
    const qValue = Math.floor(31 - (quality * 30) / 100);
    command.outputOptions([`-q:v ${Math.max(1, qValue)}`]);
  } else if (format === 'png') {
    const pngComp = Math.floor(quality / 10); 
    command.outputOptions([`-compression_level ${Math.min(9, pngComp)}`]);
  }

  // 3. Chamar o motor que estava faltando
  return _execFFmpeg(inputStream, command);
}