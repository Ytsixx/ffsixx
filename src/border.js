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
 * FERRAMENTA: Border (Borda Customizada)
 * Adiciona bordas com controle de espessura, cor e raio de arredondamento.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {number} options.thickness  - Espessura da borda em px. Padrão: 10
 * @param {string} options.color      - Cor da borda. Padrão: 'white'
 * @param {string} options.style      - 'solid' | 'double' | 'shadow'. Padrão: 'solid'
 */
export async function border(buffer, { thickness = 10, color = 'white', style = 'solid' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const t = Math.max(1, Math.min(200, thickness));
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  let filter;
  switch (style) {
    case 'solid':
      filter = `pad=iw+${t * 2}:ih+${t * 2}:${t}:${t}:${color}`;
      break;

    case 'double':
      // Borda dupla: cor principal + linha interna mais escura
      filter = [
        `pad=iw+${t * 2}:ih+${t * 2}:${t}:${t}:${color}`,
        `pad=iw+${Math.floor(t * 0.3) * 2}:ih+${Math.floor(t * 0.3) * 2}:${Math.floor(t * 0.3)}:${Math.floor(t * 0.3)}:black@0.3`
      ].join(',');
      break;

    case 'shadow':
      // Sombra projetada: borda + sombra deslocada
      filter = [
        `pad=iw+${t * 2}:ih+${t * 2}:${t}:${t}:${color}`,
        `pad=iw+${t}:ih+${t}:0:0:black@0.4`
      ].join(',');
      break;

    default:
      throw new Error(`Estilo '${style}' inválido. Use: 'solid', 'double' ou 'shadow'.`);
  }

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    thickness: t,
    color,
    style,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'border'
  };
}
