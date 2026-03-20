/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';
import { resolve } from 'path';

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
 * UTILITÁRIO: strip — Remove metadados EXIF da imagem
 */
export async function strip(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .format('mjpeg')
    .outputOptions(['-map_metadata -1']);

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    originalSizeKB: Math.round(buffer.length / 1024),
    sizeKB: Math.round(resBuffer.length / 1024),
    saved: Math.round((buffer.length - resBuffer.length) / 1024),
    type: 'stripped'
  };
}

/**
 * UTILITÁRIO: toBase64 — Converte Buffer para string Base64
 */
export function toBase64(buffer, mimeType = 'image/jpeg') {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const base64 = buffer.toString('base64');
  return {
    base64,
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
    sizeKB: Math.round(buffer.length / 1024),
    type: 'base64'
  };
}

/**
 * UTILITÁRIO: fromBase64 — Converte string Base64 ou dataURL para Buffer
 */
export function fromBase64(input) {
  if (typeof input !== 'string') throw new Error('O input deve ser uma string.');

  const clean = input.includes(',') ? input.split(',')[1] : input;
  const buffer = Buffer.from(clean, 'base64');

  return {
    buffer,
    sizeKB: Math.round(buffer.length / 1024),
    type: 'fromBase64'
  };
}

/**
 * UTILITÁRIO: getInfo — Retorna metadados da imagem sem processar
 */
export function getInfo(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const dims = sizeOf(buffer);

  return {
    width: dims.width,
    height: dims.height,
    format: dims.type,
    aspectRatio: dims.width && dims.height ? `${dims.width}:${dims.height}` : null,
    megapixels: dims.width && dims.height
      ? Math.round((dims.width * dims.height) / 1_000_000 * 100) / 100
      : null,
    sizeKB: Math.round(buffer.length / 1024),
    sizeMB: Math.round(buffer.length / (1024 * 1024) * 100) / 100,
    isLandscape: dims.width > dims.height,
    isPortrait: dims.height > dims.width,
    isSquare: dims.width === dims.height,
    type: 'info'
  };
}

/**
 * Gera um BMP sólido em memória puro Node.js — sem dependência de lavfi.
 * BMP é suportado nativamente em qualquer build do FFmpeg.
 */
function _createBMP(width, height, r, g, b) {
  const rowSize = Math.floor((3 * width + 3) / 4) * 4; // padding para 4 bytes
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buf = Buffer.alloc(fileSize, 0);

  // File Header (14 bytes)
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);

  // DIB Header - BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // negativo = top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);    // 24bpp
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelDataSize, 34);

  // Pixel data (BMP usa ordem BGR)
  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    offset += rowSize - width * 3; // padding da linha
  }

  return buf;
}

/**
 * UTILITÁRIO: placeholder — Gera imagem colorida com texto (útil para testes/mockups)
 * @param {Object} options
 * @param {number} options.width     - Largura. Padrão: 400
 * @param {number} options.height    - Altura. Padrão: 300
 * @param {string} options.color     - Cor de fundo em HEX. Padrão: '#3498db'
 * @param {string} options.text      - Texto a exibir. Padrão: dimensões (ex: '400x300')
 * @param {string} options.textColor - Cor do texto. Padrão: 'white'
 */
export async function placeholder({
  width = 400,
  height = 300,
  color = '#3498db',
  text = null,
  textColor = 'white'
} = {}) {
  const displayText = text || `${width}x${height}`;
  const fontPath = resolve('./database/fontes/SNPro-Bold.ttf');
  const fontSize = Math.max(16, Math.min(72, Math.floor(Math.min(width, height) / 8)));

  // Converte HEX -> RGB para o gerador de BMP
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) || 52;
  const g = parseInt(hex.slice(2, 4), 16) || 152;
  const b = parseInt(hex.slice(4, 6), 16) || 219;

  // Gera canvas sólido como BMP puro em memória (sem lavfi)
  const bmpBuffer = _createBMP(width, height, r, g, b);
  const inputStream = Readable.from(bmpBuffer);

  const command = ffmpeg(inputStream)
    .inputFormat('bmp_pipe')
    .videoFilters([{
      filter: 'drawtext',
      options: {
        text: displayText,
        fontfile: fontPath,
        fontsize: fontSize,
        fontcolor: textColor,
        x: '(w-tw)/2',
        y: '(h-th)/2',
        shadowcolor: 'black@0.3',
        shadowx: 2,
        shadowy: 2
      }
    }])
    .format('mjpeg');

  const resBuffer = await _execFFmpeg(inputStream, command);

  return {
    buffer: resBuffer,
    width,
    height,
    color,
    text: displayText,
    sizeKB: Math.round(resBuffer.length / 1024),
    type: 'placeholder'
  };
}