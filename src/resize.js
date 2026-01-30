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
 * @param {number} width - Largura alvo
 * @param {number} height - Altura alvo
 * @param {Object} options - Configurações extras (opcional)
 */
export async function resize(buffer, width = -1, height = -1, options = { keepRatio: true, upscale: false }) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  // 1. Inteligência: Checa tamanho original para evitar Upscale desnecessário
  const specs = sizeOf(buffer);
  
  if (!options.upscale) {
    const isLarger = (width > specs.width && width !== -1) || (height > specs.height && height !== -1);
    if (isLarger) {
      console.log('ℹ️ Anti-Upscale: Mantendo tamanho original para preservar qualidade.');
      return buffer;
    }
  }

  // 2. Configuração do FFmpeg
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream).inputFormat('image2pipe');

  const aspect = options.keepRatio ? ':force_original_aspect_ratio=decrease' : '';
  const scaleFilter = `scale=${width}:${height}${aspect}`;

  command
    .videoFilters(scaleFilter)
    .format('mjpeg');

  // 3. Execução
  return _execFFmpeg(inputStream, command);
}
