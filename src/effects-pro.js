/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Effects & Tools PRO ───────────────────────────────────────────────
 * Remove Background, Face Crop, QR Overlay, Meme Filters,
 * Collage Avançada e Presets prontos.
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sizeOf from 'image-size';
import { createProgress } from './progress.js';

const execFileP = promisify(execFile);

function _tmp(ext) {
  return join(tmpdir(), `ffsixx_pro_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}
function _sizeKB(buf) { return Math.round(buf.length / 1024); }
async function _cleanup(...paths) {
  await Promise.allSettled(paths.map(p => unlink(p).catch(() => {})));
}

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

// ─── removeBackground ─────────────────────────────────────────────────────────

/**
 * Remove o fundo da imagem.
 * Tenta rembg (Python, preciso) → fallback para chroma key (FFmpeg, fundo sólido).
 *
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {string}  [options.method='auto']   - 'auto' | 'rembg' | 'chroma'
 * @param {string}  [options.chromaColor='green'] - Cor do chroma key: 'green' | 'blue' | hex
 * @param {number}  [options.chromaSimilarity=0.3] - Tolerância do chroma (0-1)
 * @param {number}  [options.chromaBlend=0.1]      - Suavidade da borda
 * @param {string}  [options.background='transparent'] - Fundo após remoção: 'transparent' | cor hex
 * @param {Function}[options.onProgress]
 * @returns {Promise<{ buffer, method, sizeKB, type }>}
 */
export async function removeBackground(buffer, {
  method = 'auto',
  chromaColor = 'green',
  chromaSimilarity = 0.3,
  chromaBlend = 0.1,
  background = 'transparent',
  onProgress = null,
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('removeBackground: input deve ser Buffer.');

  const p = createProgress(onProgress);
  p.start({ operation: 'removeBackground' });

  // Tenta rembg se method for 'auto' ou 'rembg'
  if (method === 'auto' || method === 'rembg') {
    try {
      p.processing({ stage: 'Tentando rembg...' });
      const result = await _removeWithRembg(buffer, background);
      p.done();
      return { ...result, method: 'rembg' };
    } catch (err) {
      if (method === 'rembg') throw err;
      // Fallback silencioso para chroma
    }
  }

  // Chroma key via FFmpeg
  p.processing({ stage: 'Aplicando chroma key...' });
  const result = await _removeWithChroma(buffer, { chromaColor, chromaSimilarity, chromaBlend, background });
  p.done();
  return { ...result, method: 'chroma' };
}

async function _removeWithRembg(buffer, background) {
  const inPath  = _tmp('jpg');
  const outPath = _tmp('png');

  await writeFile(inPath, buffer);

  try {
    // Verifica se rembg está disponível
    await execFileP('python3', ['-c', 'import rembg']);

    // Script inline para processar com rembg
    const script = `
import sys
from rembg import remove
from PIL import Image
import io

with open(sys.argv[1], 'rb') as f:
    inp = f.read()

output = remove(inp)

${background !== 'transparent' ? `
img = Image.open(io.BytesIO(output)).convert('RGBA')
bg  = Image.new('RGBA', img.size, '${background}')
bg.paste(img, mask=img.split()[3])
bg.convert('RGB').save(sys.argv[2])
` : `
with open(sys.argv[2], 'wb') as f:
    f.write(output)
`}
`;

    const scriptPath = _tmp('py');
    await writeFile(scriptPath, script);

    await execFileP('python3', [scriptPath, inPath, outPath]);
    await unlink(scriptPath).catch(() => {});

    const buf = await readFile(outPath);
    return { buffer: buf, sizeKB: _sizeKB(buf), type: 'remove_background' };
  } finally {
    await _cleanup(inPath, outPath);
  }
}

async function _removeWithChroma(buffer, { chromaColor, chromaSimilarity, chromaBlend, background }) {
  const inputStream = Readable.from(buffer);

  // Mapeia cores named para valores RGB usados pelo FFmpeg
  const colorMap = { green: '0x00FF00', blue: '0x0000FF', white: '0xFFFFFF', black: '0x000000' };
  const colorHex = colorMap[chromaColor] || chromaColor.replace('#', '0x');

  let filter;
  if (background === 'transparent') {
    filter = [
      'format=rgba',
      `colorkey=${colorHex}:similarity=${chromaSimilarity}:blend=${chromaBlend}`
    ].join(',');
  } else {
    filter = [
      `colorkey=${colorHex}:similarity=${chromaSimilarity}:blend=${chromaBlend}`,
      `pad=iw:ih:0:0:${background}`
    ].join(',');
  }

  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filter)
    .outputOptions(['-vcodec png', '-pix_fmt rgba'])
    .format('image2');

  const buf = await _execFFmpeg(inputStream, command);
  return { buffer: buf, sizeKB: _sizeKB(buf), type: 'remove_background' };
}

// ─── faceCrop ─────────────────────────────────────────────────────────────────

/**
 * Detecta o conteúdo principal via cropdetect e centraliza o crop.
 * Usa heurística do FFmpeg (sem ML) — funciona melhor para retratos.
 *
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {number}  [options.width=500]    - Largura do crop final
 * @param {number}  [options.height=500]   - Altura do crop final
 * @param {number}  [options.limit=24]     - Sensibilidade cropdetect (0-255). Padrão: 24
 * @param {boolean} [options.square=false] - Força resultado quadrado
 * @param {Function}[options.onProgress]
 * @returns {Promise<{ buffer, x, y, cropWidth, cropHeight, sizeKB, type }>}
 */
export async function faceCrop(buffer, {
  width = 500, height = 500, limit = 24, square = false, onProgress = null
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('faceCrop: input deve ser Buffer.');

  const p = createProgress(onProgress);
  p.start({ operation: 'faceCrop' });

  const inPath  = _tmp('jpg');
  const outPath = _tmp('jpg');

  await writeFile(inPath, buffer);

  try {
    p.processing({ stage: 'Detectando região...' });

    // 1. Roda cropdetect para identificar a região com conteúdo
    const detectResult = await new Promise((resolve, reject) => {
      let output = '';
      ffmpeg(inPath)
        .videoFilters(`cropdetect=limit=${limit}:round=2:skip=0`)
        .format('null')
        .output('/dev/null')
        .on('stderr', line => { output += line + '\n'; })
        .on('end', () => resolve(output))
        .on('error', (err, stdout, stderr) => resolve(stderr || output)) // cropdetect escreve no stderr
        .run();
    });

    // 2. Extrai o último crop detectado (mais preciso)
    const matches = [...detectResult.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
    const dims    = sizeOf(buffer);

    let cropW, cropH, cropX, cropY;

    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      cropW = parseInt(last[1]);
      cropH = parseInt(last[2]);
      cropX = parseInt(last[3]);
      cropY = parseInt(last[4]);
    } else {
      // Fallback: crop centralizado inteligente (regra dos terços)
      cropW = Math.round(dims.width  * 0.7);
      cropH = Math.round(dims.height * 0.7);
      cropX = Math.round((dims.width  - cropW) / 2);
      cropY = Math.round((dims.height - cropH) * 0.35); // ligeiramente acima do centro
    }

    // 3. Se square, ajusta para o menor lado
    if (square) {
      const side = Math.min(cropW, cropH);
      cropX = cropX + Math.round((cropW - side) / 2);
      cropY = cropY + Math.round((cropH - side) / 2);
      cropW = side;
      cropH = side;
    }

    p.encoding({ stage: 'Aplicando crop...' });

    // 4. Aplica crop + resize para dimensões finais
    const finalW = square ? Math.min(width, height) : width;
    const finalH = square ? Math.min(width, height) : height;

    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .videoFilters([
          `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
          `scale=${finalW}:${finalH}:force_original_aspect_ratio=decrease`,
          `pad=${finalW}:${finalH}:(ow-iw)/2:(oh-ih)/2:white`
        ])
        .format('mjpeg')
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`faceCrop: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    p.done();

    return {
      buffer:    buf,
      x:         cropX,
      y:         cropY,
      cropWidth: cropW,
      cropHeight:cropH,
      sizeKB:    _sizeKB(buf),
      type:      'face_crop'
    };
  } finally {
    await _cleanup(inPath, outPath);
  }
}

// ─── qrOverlay ────────────────────────────────────────────────────────────────

/**
 * Gera um QR code e cola sobre a imagem.
 * Implementação pura em FFmpeg usando drawbox + drawtext para padrão QR simples.
 *
 * Para QR codes reais e complexos, instale 'qrcode' e use qrOverlayFull().
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string}  options.data               - Conteúdo do QR (URL, texto)
 * @param {string}  [options.position='bottom-right']
 * @param {number}  [options.size=120]         - Tamanho do QR em px
 * @param {string}  [options.bgColor='white']  - Cor de fundo do QR
 * @param {string}  [options.fgColor='black']  - Cor dos módulos do QR
 * @param {number}  [options.margin=10]        - Margem da borda da imagem
 * @param {Function}[options.onProgress]
 * @returns {Promise<{ buffer, data, position, sizeKB, type, note }>}
 */
export async function qrOverlay(buffer, {
  data, position = 'bottom-right', size = 120,
  bgColor = 'white', fgColor = 'black', margin = 10, onProgress = null
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('qrOverlay: input deve ser Buffer.');
  if (!data) throw new Error('qrOverlay: forneça data (conteúdo do QR).');

  const p = createProgress(onProgress);
  p.start({ operation: 'qrOverlay' });

  // Tenta usar lib 'qrcode' se disponível
  try {
    const qr = await import('qrcode');
    p.processing({ stage: 'Gerando QR code...' });
    const qrBuffer = await qr.toBuffer(data, {
      type: 'png', width: size, margin: 1,
      color: { dark: fgColor, light: bgColor }
    });
    p.encoding();

    // Cola usando overlay
    const { overlay } = await import('./overlay.js');
    const posMap = {
      'bottom-right': null, 'bottom-left': null,
      'top-right': null, 'top-left': null, 'center': null
    };

    const result = await overlay(buffer, qrBuffer, {
      position, scale: size / 512, opacity: 1
    });

    p.done();
    return { buffer: result.buffer, data, position, sizeKB: _sizeKB(result.buffer), type: 'qr_overlay', engine: 'qrcode' };

  } catch {
    // Fallback: QR representativo via drawbox (visual simplificado)
    p.processing({ stage: 'Gerando QR (fallback)...' });
  }

  // Fallback FFmpeg: caixa branca com texto URL no canto
  const dims = sizeOf(buffer);

  const posMap = {
    'bottom-right': { x: dims.width  - size - margin, y: dims.height - size - margin },
    'bottom-left':  { x: margin,                      y: dims.height - size - margin },
    'top-right':    { x: dims.width  - size - margin, y: margin },
    'top-left':     { x: margin,                      y: margin },
    'center':       { x: Math.round((dims.width  - size) / 2), y: Math.round((dims.height - size) / 2) },
  };

  const pos = posMap[position] || posMap['bottom-right'];

  // Gera padrão visual de QR usando drawbox encadeados
  const fontSize = Math.max(8, Math.floor(size / 12));
  const shortData = data.length > 20 ? data.slice(0, 18) + '..' : data;

  const filters = [
    // Fundo branco
    `drawbox=x=${pos.x}:y=${pos.y}:w=${size}:h=${size}:color=${bgColor}:t=fill`,
    // Borda
    `drawbox=x=${pos.x}:y=${pos.y}:w=${size}:h=${size}:color=${fgColor}:t=3`,
    // Padrão de finder (3 cantos)
    `drawbox=x=${pos.x+4}:y=${pos.y+4}:w=${Math.round(size*0.25)}:h=${Math.round(size*0.25)}:color=${fgColor}:t=fill`,
    `drawbox=x=${pos.x + size - Math.round(size*0.25) - 4}:y=${pos.y+4}:w=${Math.round(size*0.25)}:h=${Math.round(size*0.25)}:color=${fgColor}:t=fill`,
    `drawbox=x=${pos.x+4}:y=${pos.y + size - Math.round(size*0.25) - 4}:w=${Math.round(size*0.25)}:h=${Math.round(size*0.25)}:color=${fgColor}:t=fill`,
    // Dados simulados (grid de pontos)
    `drawbox=x=${pos.x + Math.round(size*0.35)}:y=${pos.y + Math.round(size*0.35)}:w=${Math.round(size*0.3)}:h=${Math.round(size*0.3)}:color=${fgColor}:t=fill`,
  ];

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filters)
    .format('mjpeg');

  p.encoding();
  const resBuffer = await _execFFmpeg(inputStream, command);
  p.done();

  return {
    buffer:   resBuffer,
    data,
    position,
    sizeKB:   _sizeKB(resBuffer),
    type:     'qr_overlay',
    engine:   'ffmpeg-fallback',
    note:     'Para QR codes reais, instale: npm install qrcode'
  };
}

// ─── memeFilter ───────────────────────────────────────────────────────────────

/**
 * Filtros de meme prontos — deepfry, skeleton, vhs, matrix e mais.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string}  options.preset             - 'deepfry' | 'vhs' | 'matrix' | 'xray' | 'comic' | 'oil'
 * @param {number}  [options.intensity=1]      - Intensidade do efeito (0.1-3)
 * @param {Function}[options.onProgress]
 * @returns {Promise<{ buffer, preset, sizeKB, type }>}
 */
export async function memeFilter(buffer, { preset, intensity = 1, onProgress = null } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('memeFilter: input deve ser Buffer.');
  if (!preset) throw new Error('memeFilter: forneça preset.');

  const p = createProgress(onProgress);
  p.start({ operation: 'memeFilter' });

  const i = Math.max(0.1, Math.min(3, intensity));

  const presets = {
    // 🔥 Deepfry: saturação máxima, contraste absurdo, ruído, JPEG artefatos
    deepfry: [
      `eq=contrast=${1.5 * i}:saturation=${3 * i}:brightness=${0.1 * i}`,
      `noise=alls=${40 * i}:allf=t`,
      `unsharp=5:5:${2 * i}:5:5:0`,
      `eq=gamma=${0.7}`
    ].join(','),

    // 📼 VHS: scan lines, aberração cromática, ruído analógico
    vhs: [
      `rgbashift=rh=${Math.round(4 * i)}:bh=-${Math.round(4 * i)}`,
      `noise=alls=${15 * i}:allf=t+u`,
      `eq=contrast=${1 + 0.2 * i}:saturation=${0.8}:brightness=-0.05`,
      `curves=vintage`
    ].join(','),

    // 💚 Matrix: verde monocromático
    matrix: [
      'format=gray',
      'format=rgb24',
      `curves=r='0/0 1/0':g='0/0 1/${Math.min(1, 0.9 * i)}':b='0/0 1/0'`,
      `eq=contrast=${1.2 * i}:brightness=-0.1`
    ].join(','),

    // ☠️  X-ray: negativo com alto contraste
    xray: [
      'format=gray',
      'negate',
      `eq=contrast=${2 * i}:gamma=0.8`,
      `unsharp=3:3:${1.5 * i}:3:3:0`
    ].join(','),

    // 💥 Comic: posterize + bordas fortes (estilo comic book)
    comic: [
      `eq=saturation=${1.8 * i}:contrast=${1.3 * i}`,
      `posterize=levels=${Math.max(2, Math.round(6 / i))}`,
      `unsharp=5:5:${1.5 * i}:5:5:0`,
      `edgedetect=low=${0.05 * i}:high=${0.15 * i}:mode=colormix`
    ].join(','),

    // 🎨 Oil painting: blur + saturação + suavização
    oil: [
      `gblur=sigma=${2 * i}`,
      `eq=saturation=${1.5 * i}:contrast=1.1`,
      `unsharp=${Math.round(3 + 2 * i)}:${Math.round(3 + 2 * i)}:${1.5 * i}:0:0:0`
    ].join(','),

    // 🌈 Vaporwave: roxo + ciano, estilo synthwave
    vaporwave: [
      `curves=r='0/0.1 0.5/0.7 1/0.9':g='0/0 0.5/0.3 1/0.6':b='0/0.2 0.5/0.8 1/1'`,
      `eq=saturation=${1.8 * i}:contrast=1.1`,
      `gblur=sigma=${0.5 * i}`
    ].join(','),

    // 🔴 Redscale: vermelho monocromático estilo lomografia
    redscale: [
      'format=gray',
      'format=rgb24',
      `curves=r='0/0 1/${Math.min(1, i)}':g='0/0 1/0':b='0/0 1/0'`,
      `eq=contrast=${1.1 * i}:brightness=0.05`
    ].join(','),
  };

  if (!presets[preset]) {
    throw new Error(`memeFilter: preset '${preset}' inválido. Use: ${Object.keys(presets).join(', ')}`);
  }

  p.processing({ stage: `Aplicando ${preset}...` });

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(presets[preset])
    .format('mjpeg');

  p.encoding();
  const resBuffer = await _execFFmpeg(inputStream, command);
  p.done();

  return { buffer: resBuffer, preset, intensity: i, sizeKB: _sizeKB(resBuffer), type: 'meme_filter' };
}

// ─── advancedCollage ──────────────────────────────────────────────────────────

/**
 * Collage avançada com layouts pré-definidos, cantos arredondados e sombras.
 *
 * @param {Buffer[]} buffers
 * @param {Object} [options]
 * @param {string}  [options.layout='grid']   - 'grid' | 'instagram' | 'tiktok' | 'story' | 'horizontal' | 'vertical'
 * @param {number}  [options.gap=8]           - Espaço entre células
 * @param {string}  [options.background='#1a1a1a'] - Cor de fundo
 * @param {number}  [options.radius=0]        - Raio dos cantos arredondados (px)
 * @param {boolean} [options.shadow=false]    - Sombra nas células
 * @param {number}  [options.outputWidth=1080]- Largura total do output
 * @param {Function}[options.onProgress]
 * @returns {Promise<{ buffer, layout, width, height, count, sizeKB, type }>}
 */
export async function advancedCollage(buffers, {
  layout = 'grid',
  gap = 8,
  background = '#1a1a1a',
  radius = 0,
  shadow = false,
  outputWidth = 1080,
  onProgress = null,
} = {}) {
  if (!Array.isArray(buffers) || buffers.length < 2) {
    throw new Error('advancedCollage: forneça ao menos 2 imagens.');
  }

  const p = createProgress(onProgress);
  p.start({ operation: 'advancedCollage' });

  // Layouts pré-definidos
  const LAYOUTS = {
    grid:       { cols: Math.ceil(Math.sqrt(buffers.length)), ratio: 1 },
    instagram:  { cols: 3,  ratio: 1    },     // 3x3 quadrado
    tiktok:     { cols: 2,  ratio: 16/9 },     // 2 colunas, formato 9:16
    story:      { cols: 1,  ratio: 16/9 },     // coluna única 9:16
    horizontal: { cols: buffers.length, ratio: 1 },
    vertical:   { cols: 1,  ratio: 1    },
  };

  const config = LAYOUTS[layout] || LAYOUTS.grid;
  const cols   = Math.min(config.cols, buffers.length);
  const rows   = Math.ceil(buffers.length / cols);

  const cellW  = Math.floor((outputWidth - gap * (cols + 1)) / cols);
  const cellH  = Math.round(cellW / config.ratio);
  const totalW = outputWidth;
  const totalH = rows * cellH + gap * (rows + 1);

  const tmpFiles = [];

  p.processing({ stage: 'Preparando imagens...' });

  try {
    // Salva cada buffer em arquivo temporário
    for (const buf of buffers) {
      const path = _tmp('jpg');
      await writeFile(path, buf);
      tmpFiles.push(path);
    }

    const filterParts = [];
    const count = buffers.length;

    // Escala + (opcional) shadow por célula
    for (let i = 0; i < count; i++) {
      let scale = `scale=${cellW}:${cellH}:force_original_aspect_ratio=increase,crop=${cellW}:${cellH}`;
      if (shadow) {
        scale += `,pad=${cellW + 10}:${cellH + 10}:5:5:black@0.3`;
      }
      filterParts.push(`[${i}:v]${scale}[cell${i}]`);
    }

    // Canvas base
    filterParts.push(`color=c=${background.replace('#', '0x')}:size=${totalW}x${totalH}:rate=1[canvas]`);

    // Posiciona cada célula
    let current = 'canvas';
    for (let i = 0; i < count; i++) {
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      const x    = gap + col * (cellW + gap);
      const y    = gap + row * (cellH + gap);
      const out  = i === count - 1 ? 'out' : `tmp${i}`;
      filterParts.push(`[${current}][cell${i}]overlay=x=${x}:y=${y}[${out}]`);
      current = out;
    }

    const outPath = _tmp('jpg');
    tmpFiles.push(outPath);

    p.encoding({ stage: 'Montando collage...' });

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      for (const f of tmpFiles.slice(0, count)) cmd.input(f);

      cmd.complexFilter(filterParts, 'out')
        .format('mjpeg')
        .outputOptions(['-frames:v 1'])
        .output(outPath)
        .on('end', resolve)
        .on('error', err => reject(new Error(`advancedCollage: ${err.message}`)))
        .run();
    });

    const buf = await readFile(outPath);
    p.done();

    return {
      buffer: buf,
      layout,
      width:  totalW,
      height: totalH,
      count,
      columns: cols,
      rows,
      sizeKB: _sizeKB(buf),
      type:   'advanced_collage'
    };

  } finally {
    await Promise.allSettled(tmpFiles.map(f => unlink(f).catch(() => {})));
  }
}

// ─── presets ─────────────────────────────────────────────────────────────────

/**
 * Presets prontos para redes sociais.
 * Redimensiona e otimiza para a plataforma escolhida.
 *
 * @param {Buffer} buffer
 * @param {Object} options
 * @param {string}  options.platform           - 'instagram' | 'tiktok' | 'whatsapp_story' |
 *                                               'discord' | 'twitter' | 'youtube_thumb' | 'facebook'
 * @param {string}  [options.variant='post']   - Variante da plataforma (instagram: 'post' | 'story' | 'reel')
 * @param {boolean} [options.compress=true]    - Comprimir para o limite da plataforma
 * @param {Function}[options.onProgress]
 * @returns {Promise<{ buffer, platform, variant, width, height, sizeKB, type }>}
 */
export async function applyPreset(buffer, {
  platform, variant = 'post', compress = true, onProgress = null
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('applyPreset: input deve ser Buffer.');
  if (!platform) throw new Error('applyPreset: forneça platform.');

  const p = createProgress(onProgress);
  p.start({ operation: 'applyPreset' });

  const PRESETS = {
    instagram: {
      post:      { w: 1080, h: 1080, maxKB: 8000,  fit: 'cover'   },
      story:     { w: 1080, h: 1920, maxKB: 8000,  fit: 'cover'   },
      reel:      { w: 1080, h: 1920, maxKB: 4000,  fit: 'cover'   },
      landscape: { w: 1080, h: 566,  maxKB: 8000,  fit: 'cover'   },
    },
    tiktok: {
      post:      { w: 1080, h: 1920, maxKB: 10000, fit: 'cover'   },
      cover:     { w: 1080, h: 1080, maxKB: 5000,  fit: 'cover'   },
    },
    whatsapp_story: {
      post:      { w: 1080, h: 1920, maxKB: 1024,  fit: 'contain' },
    },
    discord: {
      post:      { w: 1280, h: 720,  maxKB: 8000,  fit: 'contain' },
      avatar:    { w: 128,  h: 128,  maxKB: 256,   fit: 'cover'   },
      banner:    { w: 960,  h: 540,  maxKB: 4000,  fit: 'cover'   },
    },
    twitter: {
      post:      { w: 1200, h: 675,  maxKB: 5120,  fit: 'cover'   },
      header:    { w: 1500, h: 500,  maxKB: 5120,  fit: 'cover'   },
      avatar:    { w: 400,  h: 400,  maxKB: 2048,  fit: 'cover'   },
    },
    youtube_thumb: {
      post:      { w: 1280, h: 720,  maxKB: 2048,  fit: 'cover'   },
    },
    facebook: {
      post:      { w: 1200, h: 630,  maxKB: 8192,  fit: 'cover'   },
      story:     { w: 1080, h: 1920, maxKB: 4096,  fit: 'cover'   },
      cover:     { w: 820,  h: 312,  maxKB: 4096,  fit: 'cover'   },
    },
  };

  const platformMap = PRESETS[platform];
  if (!platformMap) {
    throw new Error(`applyPreset: plataforma '${platform}' não suportada. Use: ${Object.keys(PRESETS).join(', ')}`);
  }

  const spec = platformMap[variant] || platformMap[Object.keys(platformMap)[0]];

  p.processing({ stage: `Aplicando preset ${platform}/${variant}...` });

  // 1. Redimensiona
  const inputStream = Readable.from(buffer);
  const filterStr   = spec.fit === 'cover'
    ? `scale=${spec.w}:${spec.h}:force_original_aspect_ratio=increase,crop=${spec.w}:${spec.h}`
    : `scale=${spec.w}:${spec.h}:force_original_aspect_ratio=decrease,pad=${spec.w}:${spec.h}:(ow-iw)/2:(oh-ih)/2:black`;

  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters(filterStr)
    .format('mjpeg');

  p.encoding();
  let resBuffer = await _execFFmpeg(inputStream, command);

  // 2. Comprime se necessário
  if (compress && resBuffer.length > spec.maxKB * 1024) {
    const { compress: compressFn } = await import('./compress.js');
    const compressed = await compressFn(resBuffer, { maxSizeKB: spec.maxKB, mode: 'balanced' });
    resBuffer = compressed.buffer;
  }

  p.done();

  return {
    buffer:   resBuffer,
    platform,
    variant,
    width:    spec.w,
    height:   spec.h,
    maxKB:    spec.maxKB,
    sizeKB:   _sizeKB(resBuffer),
    type:     'preset'
  };
}