/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Text Overlay PRO ──────────────────────────────────────────────────
 * Texto avançado sobre imagens com suporte a:
 * - Fontes .ttf personalizadas
 * - Sombra e outline configuráveis
 * - Múltiplas linhas com auto-wrap
 * - Auto-fit (ajusta tamanho para caber)
 * - Posicionamento preciso
 * - onProgress callback
 *
 * @example
 * import { textOverlay, memeGenerator } from 'ffsixx';
 *
 * // Texto simples com fonte customizada
 * const result = await textOverlay(buffer, {
 *   text: 'Hello World!',
 *   font: './fonts/MyFont.ttf',
 *   fontSize: 48,
 *   color: 'white',
 *   outline: { color: 'black', width: 3 },
 *   shadow: { color: 'black', x: 2, y: 2, opacity: 0.8 },
 *   position: 'center',
 * });
 *
 * // Meme clássico
 * const meme = await memeGenerator(buffer, {
 *   top: 'QUANDO VOCÊ',
 *   bottom: 'TEM QUE ENTREGAR SEXTA',
 * });
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';
import { resolve as resolvePath } from 'path';
import { existsSync } from 'fs';
import { createProgress } from './progress.js';

const DEFAULT_FONT = resolvePath('./database/fontes/SNPro-Bold.ttf');

function _execFFmpeg(inputStream, command) {
  return new Promise((resolve, reject) => {
    const out = new PassThrough();
    const chunks = [];
    out.on('data', c => chunks.push(c));
    out.on('end', () => resolve(Buffer.concat(chunks)));
    out.on('error', err => { command.kill(); reject(err); });
    command.on('error', err => { command.kill(); reject(err); }).pipe(out, { end: true });
  });
}

function _sizeKB(buf) { return Math.round(buf.length / 1024); }

/**
 * Escapa texto para uso seguro em filtros FFmpeg drawtext.
 */
function _escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Quebra texto em múltiplas linhas baseado no tamanho da imagem e fontSize.
 */
function _wrapText(text, imageWidth, fontSize) {
  const charsPerLine = Math.floor((imageWidth * 0.9) / (fontSize * 0.55));
  if (!charsPerLine || text.length <= charsPerLine) return [text];

  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= charsPerLine) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/**
 * FERRAMENTA: textOverlay — Texto avançado sobre imagem
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string}  options.text               - Texto a exibir
 * @param {string}  [options.font]             - Path para arquivo .ttf. Padrão: SNPro-Bold
 * @param {number}  [options.fontSize=48]      - Tamanho da fonte. 0 = auto-fit
 * @param {string}  [options.color='white']    - Cor do texto
 * @param {string}  [options.position='center']- Posição: center | top | bottom | top-left | etc.
 * @param {number}  [options.margin=30]        - Margem das bordas em px
 * @param {Object}  [options.shadow]           - { color, x, y, opacity }
 * @param {Object}  [options.outline]          - { color, width }
 * @param {boolean} [options.autoWrap=true]    - Quebrar texto automaticamente
 * @param {boolean} [options.autoFit=false]    - Reduzir fontSize para caber
 * @param {number}  [options.lineSpacing=1.2]  - Espaçamento entre linhas
 * @param {Function}[options.onProgress]
 */
export async function textOverlay(buffer, {
  text = '',
  font = null,
  fontSize = 48,
  color = 'white',
  position = 'center',
  margin = 30,
  shadow = { color: 'black', x: 2, y: 2, opacity: 0.6 },
  outline = null,
  autoWrap = true,
  autoFit = false,
  lineSpacing = 1.2,
  onProgress = null,
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('textOverlay: input deve ser Buffer.');
  if (!text) throw new Error('textOverlay: forneça o texto.');

  const p = createProgress(onProgress);
  p.start({ operation: 'textOverlay' });

  const dims    = sizeOf(buffer);
  const fontPath = font && existsSync(font) ? font : DEFAULT_FONT;

  // Auto-fit: reduz fontSize até caber
  let finalFontSize = fontSize;
  if (autoFit || fontSize === 0) {
    finalFontSize = Math.min(72, Math.floor(dims.width / (text.length * 0.55)));
    finalFontSize = Math.max(12, finalFontSize);
  }

  // Auto-wrap: quebra em linhas
  const lines = autoWrap
    ? _wrapText(text, dims.width, finalFontSize)
    : text.split('\n');

  p.processing();

  // Posições base
  const posMap = {
    'center':       { x: '(w-tw)/2',          y: '(h-th)/2' },
    'top':          { x: '(w-tw)/2',          y: `${margin}` },
    'bottom':       { x: '(w-tw)/2',          y: `h-th-${margin}` },
    'top-left':     { x: `${margin}`,         y: `${margin}` },
    'top-right':    { x: `w-tw-${margin}`,    y: `${margin}` },
    'bottom-left':  { x: `${margin}`,         y: `h-th-${margin}` },
    'bottom-right': { x: `w-tw-${margin}`,    y: `h-th-${margin}` },
  };

  const basePos = posMap[position] || posMap['center'];
  const lineHeight = Math.round(finalFontSize * lineSpacing);

  // Gera um filtro drawtext por linha
  const filters = lines.map((line, i) => {
    const yOffset = lines.length > 1
      ? `${basePos.y}${i > 0 ? `+${i * lineHeight}` : ''}`
      : basePos.y;

    const opts = {
      text:      _escapeText(line),
      fontfile:  fontPath,
      fontsize:  finalFontSize,
      fontcolor: color,
      x:         basePos.x,
      y:         yOffset,
    };

    // Sombra
    if (shadow) {
      opts.shadowcolor = `${shadow.color || 'black'}@${shadow.opacity ?? 0.6}`;
      opts.shadowx     = shadow.x ?? 2;
      opts.shadowy     = shadow.y ?? 2;
    }

    // Outline (bordtext)
    if (outline) {
      opts.borderw     = outline.width ?? 2;
      opts.bordercolor = outline.color ?? 'black';
    }

    const optsStr = Object.entries(opts)
      .map(([k, v]) => `${k}=${v}`)
      .join(':');

    return `drawtext=${optsStr}`;
  });

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filters)
    .format('mjpeg');

  p.encoding();
  const resBuffer = await _execFFmpeg(inputStream, command);
  p.done();

  return {
    buffer:    resBuffer,
    lines:     lines.length,
    fontSize:  finalFontSize,
    sizeKB:    _sizeKB(resBuffer),
    type:      'text_overlay'
  };
}

/**
 * FERRAMENTA: memeGenerator — Template + texto top/bottom estilo meme clássico
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string}  [options.top='']           - Texto superior
 * @param {string}  [options.bottom='']        - Texto inferior
 * @param {number}  [options.fontSize=0]       - 0 = auto-fit baseado na largura
 * @param {string}  [options.color='white']
 * @param {Object}  [options.outline]          - Padrão: outline preto de 3px (estilo Impact)
 * @param {string}  [options.font]             - Path para fonte customizada
 * @param {Function}[options.onProgress]
 */
export async function memeGenerator(buffer, {
  top = '',
  bottom = '',
  fontSize = 0,
  color = 'white',
  outline = { color: 'black', width: 3 },
  font = null,
  onProgress = null,
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('memeGenerator: input deve ser Buffer.');
  if (!top && !bottom) throw new Error('memeGenerator: forneça top e/ou bottom.');

  const p = createProgress(onProgress);
  p.start({ operation: 'memeGenerator' });

  const dims     = sizeOf(buffer);
  const fontPath = font && existsSync(font) ? font : DEFAULT_FONT;
  const margin   = Math.round(dims.height * 0.03);

  // Auto-fit: tamanho baseado na largura da imagem
  const autoSize = autoFontSize(dims.width, top || bottom);

  const filters = [];

  if (top) {
    const topLines = _wrapText(top.toUpperCase(), dims.width, autoSize);
    const lineH    = Math.round(autoSize * 1.15);

    topLines.forEach((line, i) => {
      filters.push(_drawtextFilter({
        text: line, fontPath, fontSize: autoSize,
        color, outline,
        x: '(w-tw)/2',
        y: `${margin + i * lineH}`,
      }));
    });
  }

  if (bottom) {
    const botLines  = _wrapText(bottom.toUpperCase(), dims.width, autoSize);
    const lineH     = Math.round(autoSize * 1.15);
    const totalH    = botLines.length * lineH;

    botLines.forEach((line, i) => {
      filters.push(_drawtextFilter({
        text: line, fontPath, fontSize: autoSize,
        color, outline,
        x: '(w-tw)/2',
        y: `h-${totalH + margin}+${i * lineH}`,
      }));
    });
  }

  p.processing();

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filters)
    .format('mjpeg');

  p.encoding();
  const resBuffer = await _execFFmpeg(inputStream, command);
  p.done();

  return {
    buffer:  resBuffer,
    top,
    bottom,
    sizeKB:  _sizeKB(resBuffer),
    type:    'meme'
  };
}

function autoFontSize(width, text) {
  // Fórmula Impact-like: ajusta baseado na largura e comprimento do texto
  const base = Math.floor(width / 10);
  const adj  = text.length > 20 ? Math.floor(width / (text.length * 0.55)) : base;
  return Math.max(24, Math.min(base, adj));
}

function _drawtextFilter({ text, fontPath, fontSize, color, outline, x, y }) {
  const opts = {
    text:      _escapeText(text),
    fontfile:  fontPath,
    fontsize:  fontSize,
    fontcolor: color,
    x, y,
    shadowcolor: 'black@0.5',
    shadowx: 2,
    shadowy: 2,
  };

  if (outline) {
    opts.borderw     = outline.width ?? 3;
    opts.bordercolor = outline.color ?? 'black';
  }

  return 'drawtext=' + Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(':');
}