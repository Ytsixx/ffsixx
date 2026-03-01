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
 * FERRAMENTA: Sketch (Estilo Desenho/Lápis)
 * Transforma a imagem em um esboço artístico.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string} options.mode      - 'pencil' | 'ink' | 'charcoal'. Padrão: 'pencil'
 * @param {number} options.strength  - Intensidade das linhas (1-10). Padrão: 5
 */
export async function sketch(buffer, { mode = 'pencil', strength = 5 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(1, Math.min(10, strength));
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  let filter;
  switch (mode) {
    case 'pencil':
      // Clássico: bordas detectadas sobre fundo branco
      filter = [
        'format=gray',
        `edgedetect=low=${0.05 * s}:high=${0.15 * s}:mode=wires`,
        'negate'
      ].join(',');
      break;

    case 'ink':
      // Linhas mais grossas e contrastadas, estilo nanquim
      filter = [
        'format=gray',
        `edgedetect=low=${0.08 * s}:high=${0.2 * s}:mode=colormix`,
        `eq=contrast=${1 + s * 0.2}`,
        'negate'
      ].join(',');
      break;

    case 'charcoal':
      // Carvão: tons de cinza com textura ruidosa
      filter = [
        'format=gray',
        `unsharp=${3 + s}:${3 + s}:${s * 0.5}`,
        `noise=alls=${s * 3}:allf=u`,
        `eq=contrast=${1 + s * 0.15}:brightness=-0.1`
      ].join(',');
      break;

    default:
      throw new Error(`Modo '${mode}' inválido. Use: 'pencil', 'ink' ou 'charcoal'.`);
  }

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    mode,
    strength: s,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'sketch'
  };
}
