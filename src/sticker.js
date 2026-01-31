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

export async function sticker(buffer, options = { quality: 80 }) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const inputStream = Readable.from(buffer);
  
  // Sticker padrão: 512x512 com fundo transparente se necessário
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters([
      'scale=512:512:force_original_aspect_ratio=decrease',
      'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000'
    ])
    .format('webp')
    .outputOptions([`-q:v ${options.quality}`]);

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    format: 'webp',
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'sticker'
  };
}
