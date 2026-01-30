import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';

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
 * FERRAMENTA: Resize Inteligente (Cover, Contain, Fill)
 */
export default async function resize(buffer, { width = -1, height = -1, fit = 'cover', background = 'black' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  if (width === -1 && height === -1) throw new Error('Defina ao menos largura ou altura');

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream).inputFormat('image2pipe').format('mjpeg');

  let filter = '';

  switch (fit) {
    case 'cover':
      // 📐 SCALE + CROP: Redimensiona para preencher tudo e corta o que sobrar
      filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
      break;

    case 'contain':
      // 🖼️ SCALE + PAD: Redimensiona para caber dentro e adiciona barras (letterbox)
      filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${background}`;
      break;

    case 'fill':
      // 🛠️ SCALE (Distort): Estica a imagem para forçar o tamanho exato
      filter = `scale=${width}:${height}`;
      break;

    default:
      filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease`;
  }

  command.videoFilters(filter);

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    width,
    height,
    fit,
    sizeKB: Math.round(resBuffer.length / 1024)
  };
}
