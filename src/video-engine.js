/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Video Engine ──────────────────────────────────────────────────────
 * Motor interno para operações de vídeo.
 * Gerencia arquivos temporários e o dual-mode Buffer/Stream.
 */

import { writeFile, unlink, readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import { PassThrough, Readable } from 'stream';
import ffmpeg from 'fluent-ffmpeg';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function tmpPath(ext = 'mp4') {
  return join(tmpdir(), `ffsixx_vid_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}

/**
 * Converte qualquer input (Buffer ou Stream) para um arquivo temporário.
 * Retorna o path e uma função de cleanup.
 */
export async function inputToFile(input, ext = 'mp4') {
  const path = tmpPath(ext);

  if (Buffer.isBuffer(input)) {
    await writeFile(path, input);
  } else if (input && typeof input.pipe === 'function') {
    // Stream → arquivo
    await new Promise((resolve, reject) => {
      const ws = createWriteStream(path);
      input.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      input.on('error', reject);
    });
  } else {
    throw new TypeError('[ffsixx/video] Input deve ser Buffer ou Readable Stream.');
  }

  return {
    path,
    cleanup: () => unlink(path).catch(() => {}),
  };
}

/**
 * Executa um comando fluent-ffmpeg com output em arquivo temporário.
 * Retorna o Buffer do resultado e limpa os arquivos.
 */
export function runFFmpegToBuffer(command, outputPath) {
  return new Promise((resolve, reject) => {
    command
      .output(outputPath)
      .on('end', async () => {
        try {
          const buf = await readFile(outputPath);
          await unlink(outputPath).catch(() => {});
          resolve(buf);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async (err) => {
        await unlink(outputPath).catch(() => {});
        reject(new Error(`[ffsixx/video] FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

/**
 * Wrapper dual-mode para funções de vídeo.
 * Aceita Buffer ou Stream, retorna Buffer ou Stream.
 */
export function videoDualMode(fn) {
  return async function (input, ...args) {
    const isStream = input && typeof input.pipe === 'function' && typeof input.read === 'function';
    const isBuffer = Buffer.isBuffer(input);

    if (!isBuffer && !isStream) {
      throw new TypeError('[ffsixx/video] Input deve ser Buffer ou Readable Stream.');
    }

    // Coleta stream em buffer se necessário
    const buffer = isBuffer ? input : await _streamToBuffer(input);

    // Executa a função original (sempre Buffer in)
    const result = await fn(buffer, ...args);

    if (isStream) {
      // Retorna Readable com metadados
      const outBuf = Buffer.isBuffer(result) ? result : result.buffer;
      const outStream = Readable.from(outBuf);
      if (!Buffer.isBuffer(result)) {
        outStream.meta = { ...result, buffer: undefined };
      }
      return outStream;
    }

    return result;
  };
}

function _streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}