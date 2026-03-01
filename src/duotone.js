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
 * Converte hex (#rrggbb) para objeto {r, g, b} normalizado (0-1)
 */
function hexToNorm(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255
  };
}

/**
 * FERRAMENTA: Duotone (Duas Cores Sobrepostas)
 * Mapeia sombras e altas luzes para duas cores customizadas.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string} options.shadow    - Cor das sombras em HEX. Padrão: '#1a1a2e' (azul escuro)
 * @param {string} options.highlight - Cor dos brilhos em HEX. Padrão: '#e94560' (vermelho)
 * @param {number} options.strength  - Força do efeito (0-1). Padrão: 0.85
 */
export async function duotone(buffer, {
  shadow = '#1a1a2e',
  highlight = '#e94560',
  strength = 0.85
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = hexToNorm(shadow);
  const h = hexToNorm(highlight);
  const blend = Math.max(0, Math.min(1, strength));

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg');

  // Técnica: converte para gray, depois usa colorchannelmixer para mapear para as duas cores
  // O curves faz o mapeamento de luminância para cada canal R/G/B
  const filter = [
    'format=gray',                     // Converte para escala de cinza primeiro
    'format=rgb24',                    // Volta para RGB (necessário para colorchannelmixer)
    // Mapeia 0 (preto) -> shadow color e 255 (branco) -> highlight color via curves
    `curves=r='0/${s.r} 1/${h.r}':g='0/${s.g} 1/${h.g}':b='0/${s.b} 1/${h.b}'`,
    // Mistura com a imagem original via eq para controlar a força
    `eq=saturation=${blend * 2}`
  ].join(',');

  command.videoFilters(filter);
  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    shadow,
    highlight,
    strength: blend,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'duotone'
  };
}
