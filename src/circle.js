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

export async function circle(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const inputStream = Readable.from(buffer);
  
  /**
   * LÓGICA LIGHTWEIGHT:
   * 1. Redimensiona e corta para quadrado 500x500
   * 2. Usa vignette com ângulo extremo para criar um círculo preto/branco
   * 3. Aplica como máscara alpha
   */
  const filter = [
    'scale=500:500:force_original_aspect_ratio=increase,crop=500:500',
    'format=rgba',
    // O pulo do gato: vignette cria o degradê circular, e o lutyuv transforma em máscara sólida
    'vignette=pi/4,lutyuv=y=\'if(gt(val,128),255,0)\''
  ];

  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filter)
    .outputOptions([
      '-vcodec png',
      '-pix_fmt rgba' // Garante que o pixel format carregue a transparência
    ])
    .format('image2');

  const resBuffer = await _execFFmpeg(inputStream, command);

  if (!resBuffer || resBuffer.length === 0) {
    throw new Error('Falha crítica: FFmpeg não conseguiu gerar o PNG circular.');
  }

  return {
    buffer: resBuffer,
    format: 'png',
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'circle'
  };
}
