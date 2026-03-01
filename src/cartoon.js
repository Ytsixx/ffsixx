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
 * FERRAMENTA: Cartoon (Estilo Desenho Animado)
 * Reduz cores e realça bordas para efeito cartoon/cel-shading.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {number} options.colors    - Número de níveis de cor (2-16). Padrão: 6
 * @param {number} options.edges     - Intensidade das bordas (0-10). Padrão: 4
 */
export async function cartoon(buffer, { colors = 6, edges = 4 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const safeColors = Math.max(2, Math.min(16, colors));
  const safeEdges = Math.max(0, Math.min(10, edges));

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  // Técnica: posterize reduz as cores, depois combinamos com bordas detectadas
  const posterizeLevels = safeColors;
  const edgeLow = 0.05 + safeEdges * 0.02;
  const edgeHigh = 0.15 + safeEdges * 0.04;

  // Usamos eq para saturação alta + posterize para flat colors + leve blur para suavizar
  const filter = [
    `eq=saturation=${1.5 + safeEdges * 0.1}:contrast=1.1`,
    `gblur=sigma=0.8`,                                          // Suaviza antes de posterizar
    `posterize=levels=${posterizeLevels}`,                       // Quantiza as cores
    `unsharp=5:5:${safeEdges * 0.3}:5:5:0`                     // Realça bordas no final
  ].join(',');

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    colors: safeColors,
    edges: safeEdges,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'cartoon'
  };
}
