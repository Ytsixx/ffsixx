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
 * FERRAMENTA: Emboss (Efeito Relevo)
 * Cria ilusão de relevo em alto ou baixo contraste.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string} options.mode      - 'gray' | 'color'. Padrão: 'gray'
 * @param {number} options.strength  - Intensidade (1-10). Padrão: 5
 * @param {string} options.direction - 'tl' | 'tr' | 'bl' | 'br' (direção da luz). Padrão: 'tl'
 */
export async function emboss(buffer, { mode = 'gray', strength = 5, direction = 'tl' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(1, Math.min(10, strength));

  // Kernels de convolução para relevo em diferentes direções
  // convolution=matrix:divisor:bias
  const kernels = {
    tl: `-${s} -${s} 0 -${s} 0 ${s} 0 ${s} ${s}`,
    tr: `0 -${s} -${s} ${s} 0 -${s} ${s} ${s} 0`,
    bl: `0 ${s} ${s} -${s} 0 ${s} -${s} -${s} 0`,
    br: `${s} ${s} 0 ${s} 0 -${s} 0 -${s} -${s}`
  };

  if (!kernels[direction]) {
    throw new Error(`Direção '${direction}' inválida. Use: 'tl', 'tr', 'bl' ou 'br'.`);
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  const filters = [];
  if (mode === 'gray') filters.push('format=gray');

  filters.push(`convolution='${kernels[direction]}':'${kernels[direction]}':'${kernels[direction]}':'${kernels[direction]}':1:1:1:1:128:128:128:128`);
  filters.push(`eq=contrast=${1 + s * 0.1}`);

  command.videoFilters(filters.join(','));
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    mode,
    strength: s,
    direction,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'emboss'
  };
}
