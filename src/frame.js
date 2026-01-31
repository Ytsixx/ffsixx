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
 * FERRAMENTA: Moldura Estilizada (Frame)
 * Adiciona bordas e um leve efeito artístico.
 */
export async function frame(buffer, { color = 'white', thickness = 20 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const inputStream = Readable.from(buffer);
  
  // Filtro estável: Pad adiciona a moldura, vignette dá o estilo
  const filter = [
    `pad=iw+${thickness*2}:ih+${thickness*2}:${thickness}:${thickness}:${color}`,
    'vignette=10*PI/180' // Leve escurecimento nas bordas para profundidade
  ];

  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filter)
    .format('mjpeg'); // JPEG é 100% estável no Termux

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'framed'
  };
}
