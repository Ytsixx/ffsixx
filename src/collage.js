import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

function _execFFmpeg(command) {
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
 * FERRAMENTA: Collage (Grade de Imagens)
 * Combina múltiplos buffers em um grid usando FFmpeg filter_complex.
 *
 * @param {Buffer[]} buffers - Array de buffers de imagem
 * @param {Object}   options
 * @param {number}   options.columns    - Colunas do grid. Padrão: 2
 * @param {number}   options.cellWidth  - Largura de cada célula em px. Padrão: 400
 * @param {number}   options.cellHeight - Altura de cada célula em px. Padrão: 400
 * @param {number}   options.gap        - Espaço entre células em px. Padrão: 0
 * @param {string}   options.background - Cor do fundo/gap. Padrão: 'black'
 * @param {string}   options.fit        - Como preencher cada célula: 'cover' | 'contain'. Padrão: 'cover'
 */
export async function collage(buffers, {
  columns = 2,
  cellWidth = 400,
  cellHeight = 400,
  gap = 0,
  background = 'black',
  fit = 'cover'
} = {}) {
  if (!Array.isArray(buffers) || buffers.length < 2) {
    throw new Error('collage() requer um array com pelo menos 2 imagens.');
  }
  if (!buffers.every(b => Buffer.isBuffer(b))) {
    throw new Error('Todos os itens do array devem ser Buffers válidos.');
  }

  const count = buffers.length;
  const cols = Math.min(columns, count);
  const rows = Math.ceil(count / cols);

  const totalWidth = cols * cellWidth + (cols - 1) * gap;
  const totalHeight = rows * cellHeight + (rows - 1) * gap;

  // fluent-ffmpeg não suporta múltiplos inputs via stream
  // Solução: salvar cada buffer em arquivo temporário, processar, limpar
  const tmpFiles = [];
  try {
    // 1. Salva cada buffer em arquivo temporário
    for (let i = 0; i < count; i++) {
      const tmpPath = join(tmpdir(), `ffsixx_collage_${Date.now()}_${i}.jpg`);
      await writeFile(tmpPath, buffers[i]);
      tmpFiles.push(tmpPath);
    }

    // 2. Configura o comando com múltiplos inputs via arquivo
    const command = ffmpeg();
    for (const tmpPath of tmpFiles) {
      command.input(tmpPath);
    }

    // 3. Monta o filter_complex dinamicamente
    const filterParts = [];

    // Escala cada input para o tamanho da célula
    for (let i = 0; i < count; i++) {
      const scaleFilter = fit === 'cover'
        ? `scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=increase,crop=${cellWidth}:${cellHeight}`
        : `scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=decrease,pad=${cellWidth}:${cellHeight}:(ow-iw)/2:(oh-ih)/2:${background}`;
      filterParts.push(`[${i}:v]${scaleFilter}[cell${i}]`);
    }

    // Canvas base
    filterParts.push(`color=c=${background}:size=${totalWidth}x${totalHeight}:rate=1[canvas]`);

    // Posiciona cada célula via overlay encadeado
    let currentInput = 'canvas';
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      const outputLabel = i === count - 1 ? 'out' : `tmp${i}`;
      filterParts.push(`[${currentInput}][cell${i}]overlay=x=${x}:y=${y}[${outputLabel}]`);
      currentInput = outputLabel;
    }

    command
      .complexFilter(filterParts, 'out')
      .format('mjpeg')
      .outputOptions(['-frames:v 1']);

    const resBuffer = await _execFFmpeg(command);

    return {
      buffer: resBuffer,
      width: totalWidth,
      height: totalHeight,
      columns: cols,
      rows,
      count,
      sizeKB: Math.round(resBuffer.length / 1024),
      type: 'collage'
    };

  } finally {
    // 4. Limpa os arquivos temporários (sempre, mesmo em caso de erro)
    await Promise.allSettled(tmpFiles.map(f => unlink(f)));
  }
}
