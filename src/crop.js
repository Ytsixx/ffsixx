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
 * FERRAMENTA: Crop (Cortar Imagem)
 * @param {Buffer} buffer - Buffer da imagem original
 * @param {Object} options - { x, y, width, height }
 */
export async function crop(buffer, { x = 0, y = 0, width = 200, height = 200 } = {}) {
  // 🛡️ Blindagem: Verifica se o input é um Buffer
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  // ✂️ O filtro mágico do FFmpeg: crop=largura:altura:x:y
  const cropFilter = `crop=${width}:${height}:${x}:${y}`;
  command.videoFilters(cropFilter);

  const resBuffer = await _execFFmpeg(inputStream, command);

  // 🚀 Retorno enriquecido seguindo o padrão da nossa Lib
  return {
    buffer: resBuffer,
    width,
    height,
    x,
    y,
    sizeKB: Math.round(resBuffer.length / 1024)
  };
}
