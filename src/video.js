/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Video ─────────────────────────────────────────────────────────────
 * Suporte completo a vídeo com FFmpeg.
 * Dual-mode: Buffer in/out ou Stream in/out.
 * Hardware acceleration integrada via hwaccel: 'auto'.
 *
 * @example
 * import { thumbnail, compressVideo, videoToGif } from 'ffsixx';
 *
 * // Extrair thumbnail do segundo 5
 * const img = await thumbnail(videoBuffer, { at: 5 });
 *
 * // Comprimir com GPU se disponível
 * const compressed = await compressVideo(buffer, { crf: 28, hwaccel: 'auto' });
 *
 * // Converter trecho para GIF
 * const gif = await videoToGif(buffer, { start: 10, duration: 3, fps: 15 });
 */

import ffmpeg from 'fluent-ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { resolveHwAccel, applyHwAccelToCommand } from './hwaccel.js';
import { videoDualMode, tmpPath, runFFmpegToBuffer } from './video-engine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sizeKB(buf) { return Math.round(buf.length / 1024); }
function _sizeMB(buf) { return Math.round(buf.length / (1024 * 1024) * 100) / 100; }

async function _bufToTmp(buffer, ext) {
  const path = tmpPath(ext);
  await writeFile(path, buffer);
  return path;
}

async function _cleanup(...paths) {
  await Promise.allSettled(paths.map(p => unlink(p).catch(() => {})));
}

// ─── thumbnail ────────────────────────────────────────────────────────────────

/**
 * Extrai um frame do vídeo como imagem JPEG.
 *
 * @param {Buffer|Readable} input   - Buffer ou Stream do vídeo
 * @param {Object} [options]
 * @param {number} [options.at=1]       - Segundo do vídeo para capturar. Padrão: 1s
 * @param {number} [options.width=-1]   - Largura do thumbnail (-1 = original)
 * @param {number} [options.height=-1]  - Altura do thumbnail (-1 = original)
 * @param {number} [options.quality=85] - Qualidade JPEG (1-100)
 * @returns {Promise<{ buffer, width, height, at, sizeKB, type }>}
 */
export const thumbnail = videoDualMode(async function _thumbnail(buffer, {
  at = 1, width = -1, height = -1, quality = 85
} = {}) {
  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outPath = tmpPath('jpg');

  try {
    await new Promise((resolve, reject) => {
      const scale = (width !== -1 || height !== -1)
        ? `scale=${width === -1 ? -1 : width}:${height === -1 ? -1 : height}`
        : null;

      const cmd = ffmpeg(inPath)
        .seekInput(at)
        .frames(1)
        .outputOptions([`-q:v ${Math.round(31 - (quality * 30) / 100)}`]);

      if (scale) cmd.videoFilters(scale);
      cmd.output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`thumbnail: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    return { buffer: buf, width, height, at, sizeKB: _sizeKB(buf), type: 'thumbnail' };
  } finally {
    await _cleanup(inPath, outPath);
  }
});

// ─── extractFrames ────────────────────────────────────────────────────────────

/**
 * Extrai múltiplos frames do vídeo como array de Buffers JPEG.
 *
 * @param {Buffer|Readable} input
 * @param {Object} [options]
 * @param {number} [options.fps=1]      - Frames por segundo a extrair. Padrão: 1 fps
 * @param {number} [options.start=0]    - Segundo inicial
 * @param {number} [options.duration]   - Duração em segundos (padrão: vídeo inteiro)
 * @param {number} [options.maxFrames]  - Limite máximo de frames
 * @param {number} [options.width=-1]   - Largura de cada frame
 * @returns {Promise<{ frames: Buffer[], count, fps, sizeKB, type }>}
 */
export const extractFrames = videoDualMode(async function _extractFrames(buffer, {
  fps = 1, start = 0, duration = null, maxFrames = null, width = -1
} = {}) {
  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outDir  = join(tmpdir(), `ffsixx_frames_${Date.now()}`);
  const outPattern = join(outDir, 'frame_%04d.jpg');

  await import('fs/promises').then(fs => fs.mkdir(outDir, { recursive: true }));

  try {
    await new Promise((resolve, reject) => {
      const filters = [`fps=${fps}`];
      if (width !== -1) filters.push(`scale=${width}:-1`);

      const cmd = ffmpeg(inPath);
      if (start > 0) cmd.seekInput(start);
      if (duration)  cmd.duration(duration);

      cmd.videoFilters(filters.join(','))
        .output(outPattern)
        .on('end', resolve)
        .on('error', err => reject(new Error(`extractFrames: ${err.message}`)))
        .run();
    });

    // Lê todos os frames gerados
    const { readdir } = await import('fs/promises');
    let files = (await readdir(outDir)).sort();
    if (maxFrames) files = files.slice(0, maxFrames);

    const frames = await Promise.all(
      files.map(f => readFile(join(outDir, f)))
    );

    const totalKB = frames.reduce((s, f) => s + _sizeKB(f), 0);
    return { frames, count: frames.length, fps, sizeKB: totalKB, type: 'frames' };

  } finally {
    await _cleanup(inPath);
    const { rm } = await import('fs/promises');
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
});

// ─── compressVideo ────────────────────────────────────────────────────────────

/**
 * Comprime vídeo com controle de qualidade e hardware acceleration.
 *
 * @param {Buffer|Readable} input
 * @param {Object} [options]
 * @param {number} [options.crf=28]            - Qualidade (0=melhor, 51=pior). Padrão: 28
 * @param {string} [options.preset='fast']     - Preset de velocidade: ultrafast/fast/medium/slow
 * @param {string} [options.format='mp4']      - Formato de saída
 * @param {string} [options.codec='h264']      - Codec: 'h264' | 'hevc' | 'av1'
 * @param {'auto'|'nvenc'|'vaapi'|'videotoolbox'|false} [options.hwaccel='auto']
 * @param {number} [options.maxSizeMB]         - Alvo de tamanho em MB (compressão iterativa)
 * @returns {Promise<{ buffer, sizeKB, sizeMB, codec, backend, crf, type }>}
 */
export const compressVideo = videoDualMode(async function _compressVideo(buffer, {
  crf = 28, preset = 'fast', format = 'mp4', codec = 'h264',
  hwaccel = 'auto', maxSizeMB = null
} = {}) {
  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outPath = tmpPath(format);

  try {
    const hw = await resolveHwAccel(hwaccel, codec);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inPath);
      applyHwAccelToCommand(cmd, hw);

      const outputOptions = [
        `-vcodec ${hw.codec}`,
        `-crf ${crf}`,
        `-preset ${preset}`,
        '-acodec aac',
        '-movflags +faststart',
        ...hw.encodeFlags,
      ];

      cmd.outputOptions(outputOptions)
        .format(format)
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`compressVideo: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);

    // Compressão iterativa se maxSizeMB definido
    if (maxSizeMB && buf.length > maxSizeMB * 1024 * 1024) {
      const newCrf = Math.min(crf + 6, 45);
      await _cleanup(outPath);
      return _compressVideo(buf, { crf: newCrf, preset, format, codec, hwaccel: false, maxSizeMB });
    }

    return {
      buffer: buf,
      sizeKB: _sizeKB(buf),
      sizeMB: _sizeMB(buf),
      codec:   hw.codec,
      backend: hw.backend,
      crf,
      type: 'compressed_video'
    };
  } finally {
    await _cleanup(inPath, outPath);
  }
});

// ─── videoToGif ───────────────────────────────────────────────────────────────

/**
 * Converte um trecho de vídeo em GIF animado otimizado.
 *
 * @param {Buffer|Readable} input
 * @param {Object} [options]
 * @param {number} [options.start=0]    - Segundo inicial
 * @param {number} [options.duration=3] - Duração em segundos
 * @param {number} [options.fps=12]     - FPS do GIF
 * @param {number} [options.width=480]  - Largura do GIF
 * @param {boolean}[options.dither=true]- Usar dithering para melhor qualidade
 * @returns {Promise<{ buffer, sizeKB, fps, width, duration, type }>}
 */
export const videoToGif = videoDualMode(async function _videoToGif(buffer, {
  start = 0, duration = 3, fps = 12, width = 480, dither = true
} = {}) {
  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outPath = tmpPath('gif');

  try {
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inPath)
        .seekInput(start)
        .duration(duration);

      if (dither) {
        cmd.complexFilter([
          `[0:v] fps=${fps},scale=${width}:-1:flags=lanczos,split [a][b]`,
          '[a] palettegen=max_colors=256:stats_mode=full [pal]',
          '[b][pal] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
        ]);
      } else {
        cmd.videoFilters(`fps=${fps},scale=${width}:-1:flags=lanczos`);
      }

      cmd.format('gif')
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`videoToGif: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    return { buffer: buf, sizeKB: _sizeKB(buf), fps, width, duration, type: 'video_to_gif' };
  } finally {
    await _cleanup(inPath, outPath);
  }
});

// ─── watermarkVideo ───────────────────────────────────────────────────────────

/**
 * Adiciona marca d'água de texto ou imagem ao vídeo.
 *
 * @param {Buffer|Readable} input
 * @param {Object} options
 * @param {string} [options.text]        - Texto da marca d'água
 * @param {Buffer} [options.logo]        - Imagem da marca d'água (Buffer PNG/JPG)
 * @param {string} [options.position='bottom-right']
 * @param {number} [options.opacity=0.7]
 * @param {number} [options.fontSize=36]
 * @param {string} [options.color='white']
 * @param {'auto'|false} [options.hwaccel='auto']
 * @returns {Promise<{ buffer, sizeKB, mode, type }>}
 */
export const watermarkVideo = videoDualMode(async function _watermarkVideo(buffer, {
  text = '', logo = null, position = 'bottom-right',
  opacity = 0.7, fontSize = 36, color = 'white', hwaccel = 'auto'
} = {}) {
  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outPath = tmpPath('mp4');
  const tmpFiles = [inPath, outPath];

  try {
    const hw = await resolveHwAccel(hwaccel, 'h264');

    const posMap = {
      'top-left':     '10:10',
      'top-right':    'W-w-10:10',
      'bottom-left':  '10:H-h-10',
      'bottom-right': 'W-w-10:H-h-10',
      'center':       '(W-w)/2:(H-h)/2',
    };
    const pos = posMap[position] || posMap['bottom-right'];

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inPath);
      applyHwAccelToCommand(cmd, hw);

      if (logo && Buffer.isBuffer(logo)) {
        const logoPath = tmpPath('png');
        tmpFiles.push(logoPath);

        writeFile(logoPath, logo).then(() => {
          cmd.input(logoPath)
            .complexFilter([
              `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm]`,
              `[0:v][wm]overlay=${pos}[out]`
            ], 'out')
            .outputOptions([`-vcodec ${hw.codec}`, '-acodec copy', '-crf 23', ...hw.encodeFlags])
            .format('mp4')
            .output(outPath)
            .on('end', resolve)
            .on('error', err => reject(new Error(`watermarkVideo: ${err.message}`)))
            .run();
        }).catch(reject);

      } else if (text) {
        const fontPath = new URL('../database/fontes/SNPro-Bold.ttf', import.meta.url).pathname;
        const filter = `drawtext=text='${text.replace(/'/g, "\\'")}':fontfile=${fontPath}:fontsize=${fontSize}:fontcolor=${color}@${opacity}:x=${pos.split(':')[0]}:y=${pos.split(':')[1]}:shadowcolor=black@0.4:shadowx=2:shadowy=2`;

        cmd.videoFilters(filter)
          .outputOptions([`-vcodec ${hw.codec}`, '-acodec copy', '-crf 23', ...hw.encodeFlags])
          .format('mp4')
          .output(outPath)
          .on('end', resolve)
          .on('error', err => reject(new Error(`watermarkVideo: ${err.message}`)))
          .run();
      } else {
        reject(new Error('watermarkVideo: forneça text ou logo.'));
      }
    });

    const buf = await readFile(outPath);
    return {
      buffer: buf, sizeKB: _sizeKB(buf),
      mode: logo ? 'logo' : 'text', type: 'watermark_video'
    };
  } finally {
    await _cleanup(...tmpFiles);
  }
});

// ─── videoSpeed ───────────────────────────────────────────────────────────────

/**
 * Acelera ou desacelera um vídeo.
 *
 * @param {Buffer|Readable} input
 * @param {Object} [options]
 * @param {number} [options.factor=2]   - Fator: 0.5=metade, 1=normal, 2=dobro
 * @param {boolean}[options.keepAudio=true] - Ajusta o áudio também
 * @returns {Promise<{ buffer, sizeKB, factor, type }>}
 */
export const videoSpeed = videoDualMode(async function _videoSpeed(buffer, {
  factor = 2, keepAudio = true
} = {}) {
  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outPath = tmpPath('mp4');

  const sf = Math.max(0.25, Math.min(4, factor));

  try {
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inPath);

      // setpts controla velocidade do vídeo
      const videoFilter = `setpts=${(1 / sf).toFixed(4)}*PTS`;

      // atempo tem limite 0.5-2.0, então encadeamos para fatores extremos
      let audioFilter = null;
      if (keepAudio) {
        if (sf >= 0.5 && sf <= 2.0) {
          audioFilter = `atempo=${sf.toFixed(4)}`;
        } else if (sf > 2.0) {
          audioFilter = `atempo=2.0,atempo=${(sf / 2).toFixed(4)}`;
        } else {
          audioFilter = `atempo=0.5,atempo=${(sf / 0.5).toFixed(4)}`;
        }
      }

      cmd.videoFilters(videoFilter);
      if (audioFilter) cmd.audioFilters(audioFilter);

      cmd.outputOptions(['-vcodec libx264', '-acodec aac', '-crf 23'])
        .format('mp4')
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`videoSpeed: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    return { buffer: buf, sizeKB: _sizeKB(buf), factor: sf, type: 'video_speed' };
  } finally {
    await _cleanup(inPath, outPath);
  }
});

// ─── addSubtitle ──────────────────────────────────────────────────────────────

/**
 * Adiciona legendas ao vídeo (burned-in ou como stream).
 *
 * @param {Buffer|Readable} input
 * @param {Object} options
 * @param {string}  options.subtitles        - Conteúdo SRT ou caminho para arquivo .srt
 * @param {boolean} [options.burnIn=true]    - Se true, grava a legenda no vídeo. Se false, adiciona como stream.
 * @param {string}  [options.fontsize='24']  - Tamanho da fonte (burn-in)
 * @param {string}  [options.fontcolor='white'] - Cor da fonte
 * @returns {Promise<{ buffer, sizeKB, mode, type }>}
 */
export const addSubtitle = videoDualMode(async function _addSubtitle(buffer, {
  subtitles, burnIn = true, fontsize = 24, fontcolor = 'white'
} = {}) {
  if (!subtitles) throw new Error('addSubtitle: forneça subtitles (conteúdo SRT ou path).');

  const inPath  = await _bufToTmp(buffer, 'mp4');
  const outPath = tmpPath('mp4');
  const tmpFiles = [inPath, outPath];

  // Se for conteúdo SRT (não um path), salva em arquivo temporário
  let srtPath = subtitles;
  if (!subtitles.endsWith('.srt') && subtitles.includes('-->')) {
    srtPath = tmpPath('srt');
    tmpFiles.push(srtPath);
    await writeFile(srtPath, subtitles, 'utf-8');
  }

  try {
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(inPath);

      if (burnIn) {
        // Burn-in: legendas gravadas no vídeo permanentemente
        cmd.videoFilters(`subtitles=${srtPath}:force_style='FontSize=${fontsize},PrimaryColour=&H${_colorToHex(fontcolor)}&'`)
          .outputOptions(['-vcodec libx264', '-acodec copy', '-crf 23'])
          .format('mp4');
      } else {
        // Stream: legenda como faixa separada (pode ser ativada/desativada)
        cmd.input(srtPath)
          .outputOptions([
            '-vcodec copy', '-acodec copy',
            '-scodec mov_text', '-map 0:v', '-map 0:a', '-map 1:s'
          ])
          .format('mp4');
      }

      cmd.output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`addSubtitle: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    return {
      buffer: buf, sizeKB: _sizeKB(buf),
      mode: burnIn ? 'burn-in' : 'stream', type: 'subtitle'
    };
  } finally {
    await _cleanup(...tmpFiles);
  }
});

function _colorToHex(color) {
  const colors = { white: 'FFFFFF', black: '000000', yellow: '00FFFF', red: '0000FF' };
  return colors[color] || 'FFFFFF';
}

// ─── videoInfo ────────────────────────────────────────────────────────────────

/**
 * Retorna metadados do vídeo sem processar.
 *
 * @param {Buffer|Readable} input
 * @returns {Promise<{ duration, width, height, fps, codec, bitrate, sizeKB, type }>}
 */
export const videoInfo = videoDualMode(async function _videoInfo(buffer) {
  const inPath = await _bufToTmp(buffer, 'mp4');

  try {
    const meta = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inPath, (err, data) => {
        if (err) reject(new Error(`videoInfo: ${err.message}`));
        else resolve(data);
      });
    });

    const video  = meta.streams?.find(s => s.codec_type === 'video') || {};
    const format = meta.format || {};

    const [fpsNum, fpsDen] = (video.r_frame_rate || '30/1').split('/').map(Number);
    const fps = fpsDen ? Math.round((fpsNum / fpsDen) * 100) / 100 : 30;

    return {
      duration: Math.round((format.duration || 0) * 100) / 100,
      width:    video.width   || 0,
      height:   video.height  || 0,
      fps,
      codec:    video.codec_name || 'unknown',
      bitrate:  Math.round((format.bit_rate || 0) / 1000),
      sizeKB:   _sizeKB(buffer),
      sizeMB:   _sizeMB(buffer),
      type:     'video_info'
    };
  } finally {
    await _cleanup(inPath);
  }
});