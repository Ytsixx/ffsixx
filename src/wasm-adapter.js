/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx WASM Adapter ──────────────────────────────────────────────────────
 * Reimplementação de todas as funções da lib usando @ffmpeg/ffmpeg (WASM).
 * Cada função espelha exatamente a assinatura e o retorno da versão nativa.
 *
 * Este módulo é usado automaticamente pelo engine quando o FFmpeg
 * nativo não está disponível, ou explicitamente via createFFsixx({ useWasm: true }).
 */

import { execWasm, execWasmMulti } from './engine.js';

// ─── Helpers internos ─────────────────────────────────────────────────────────

function _sizeKB(buf) { return Math.round(buf.length / 1024); }

function _hexToNorm(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

// ─── Core ─────────────────────────────────────────────────────────────────────

export async function compress(buffer, {
  maxSizeKB = 300, quality = 90, mode = 'balanced', format = 'jpeg'
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const targetSize = maxSizeKB * 1024;
  if (buffer.length <= targetSize) {
    return { buffer, sizeKB: _sizeKB(buffer), iterations: 0, success: true, type: 'compressed' };
  }

  const outputExt = format === 'jpeg' ? 'jpg' : format;
  const maxTries = mode === 'fast' ? 3 : mode === 'balanced' ? 6 : 10;
  let currentBuffer = buffer;
  let currentQuality = quality;
  let scalePercent = 100;
  let iterations = 0;

  for (let i = 0; i < maxTries; i++) {
    iterations++;
    const qValue = Math.floor(31 - (currentQuality * 30) / 100);
    const args = [];

    if (mode !== 'fast') {
      args.push('-vf', `scale=iw*${scalePercent / 100}:-1`);
    }
    args.push('-q:v', String(Math.max(1, qValue)), '-f', format === 'jpeg' ? 'mjpeg' : format);

    currentBuffer = await execWasm(currentBuffer, args, 'jpg', outputExt);

    if (currentBuffer.length <= targetSize) break;

    currentQuality -= (mode === 'precise' ? 8 : 15);
    if (mode !== 'fast') scalePercent -= 8;
    if (currentQuality < 5) break;
  }

  return {
    buffer: currentBuffer,
    sizeKB: _sizeKB(currentBuffer),
    quality: currentQuality,
    iterations,
    success: currentBuffer.length <= targetSize,
    type: 'compressed'
  };
}

export async function resize(buffer, {
  width = -1, height = -1, fit = 'cover', background = 'black', upscale = false
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const sizeOfModule = await import('image-size');
  const sizeOf = sizeOfModule.default || sizeOfModule.sizeOf;
  const specs = sizeOf(buffer);

  if (!upscale) {
    const isLarger = (width > specs.width && width !== -1) || (height > specs.height && height !== -1);
    if (isLarger) return { buffer, width: specs.width, height: specs.height, sizeKB: _sizeKB(buffer), info: 'anti-upscale applied' };
  }

  let filter;
  if (fit === 'cover') {
    filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  } else if (fit === 'contain') {
    filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${background}`;
  } else {
    filter = `scale=${width}:${height}`;
  }

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, width, height, sizeKB: _sizeKB(res), fit };
}

export async function resizeCover(buffer, options = {}) {
  const width  = (typeof options === 'object' ? options.width  : options) || -1;
  const height = (typeof options === 'object' ? options.height : null)    || -1;

  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  if (width === -1 && height === -1) throw new Error('Defina ao menos largura ou altura');

  const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, width, height, mode: 'cover', sizeKB: _sizeKB(res) };
}

export async function crop(buffer, { x = 0, y = 0, width = 200, height = 200 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');
  const res = await execWasm(buffer, ['-vf', `crop=${width}:${height}:${x}:${y}`, '-f', 'mjpeg']);
  return { buffer: res, width, height, x, y, sizeKB: _sizeKB(res) };
}

export async function flip(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  const res = await execWasm(buffer, ['-vf', 'hflip', '-f', 'mjpeg']);
  return { buffer: res, mode: 'horizontal', sizeKB: _sizeKB(res) };
}

export async function flop(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  const res = await execWasm(buffer, ['-vf', 'vflip', '-f', 'mjpeg']);
  return { buffer: res, mode: 'vertical', sizeKB: _sizeKB(res) };
}

export async function sticker(buffer, { quality = 80 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  const filter = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000';
  const res = await execWasm(buffer, ['-vf', filter, '-q:v', String(quality), '-f', 'webp'], 'jpg', 'webp');
  return { buffer: res, format: 'webp', sizeKB: _sizeKB(res), type: 'sticker' };
}

export async function frame(buffer, { color = 'white', thickness = 20 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  const filter = `pad=iw+${thickness*2}:ih+${thickness*2}:${thickness}:${thickness}:${color},vignette=10*PI/180`;
  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, sizeKB: _sizeKB(res), type: 'framed' };
}

// ─── Transformações ───────────────────────────────────────────────────────────

export async function rotate(buffer, { angle = 90, background = 'black', expand = true } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const norm = ((angle % 360) + 360) % 360;
  let filter;

  if (norm === 0) return { buffer, angle: 0, sizeKB: _sizeKB(buffer), type: 'rotated' };
  else if (norm === 90)  filter = 'transpose=1';
  else if (norm === 180) filter = 'transpose=1,transpose=1';
  else if (norm === 270) filter = 'transpose=2';
  else {
    const rad = (norm * Math.PI) / 180;
    filter = expand
      ? `rotate=${rad}:fillcolor=${background}:ow='hypot(iw,ih)':oh='hypot(iw,ih)'`
      : `rotate=${rad}:fillcolor=${background}`;
  }

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, angle: norm, sizeKB: _sizeKB(res), type: 'rotated' };
}

export async function sharpen(buffer, { strength = 1.5, radius = 5, mode = 'sharpen' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const safeRadius = Math.max(3, Math.min(23, radius % 2 === 0 ? radius + 1 : radius));
  let filter;

  if (mode === 'blur') {
    filter = `gblur=sigma=${Math.abs(strength) * 2}`;
  } else {
    filter = `unsharp=${safeRadius}:${safeRadius}:${strength}:${safeRadius}:${safeRadius}:0`;
  }

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, mode, strength, radius: safeRadius, sizeKB: _sizeKB(res), type: 'sharpened' };
}

export async function adjust(buffer, {
  brightness = 0, contrast = 1, saturation = 1, gamma = 1
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const sb = Math.max(-1.0, Math.min(1.0, brightness));
  const sc = Math.max(-1000, Math.min(1000, contrast));
  const ss = Math.max(0, Math.min(3.0, saturation));
  const sg = Math.max(0.1, Math.min(10.0, gamma));

  if (sb === 0 && sc === 1 && ss === 1 && sg === 1) {
    return { buffer, sizeKB: _sizeKB(buffer), type: 'adjusted', info: 'no-op' };
  }

  const filter = `eq=brightness=${sb}:contrast=${sc}:saturation=${ss}:gamma=${sg}`;
  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, brightness: sb, contrast: sc, saturation: ss, gamma: sg, sizeKB: _sizeKB(res), type: 'adjusted' };
}

export async function vignette(buffer, { angle = 20, strength = 0.5 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const sa = Math.max(0, Math.min(90, angle));
  const ss = Math.max(0.1, Math.min(1.0, strength));
  const rad = (sa * Math.PI) / 180;
  const filter = `vignette=angle=${rad}:mode=forward:eval=init,colorbalance=rs=-${ss * 0.1}:gs=-${ss * 0.1}:bs=-${ss * 0.1}`;

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, angle: sa, strength: ss, sizeKB: _sizeKB(res), type: 'vignette' };
}

export async function perspective(buffer, { direction = 'right', strength = 30 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(0, Math.min(100, strength)) / 100;
  const coords = {
    left:   `${s}:${s}:1-${s}:0:${s}:1-${s}:1-${s}:1`,
    right:  `0:0:1-${s}:${s}:0:1:1-${s}:1-${s}`,
    top:    `${s}:0:1-${s}:0:0:1:1:1`,
    bottom: `0:0:1:0:${s}:1:1-${s}:1`,
  };
  if (!coords[direction]) throw new Error(`Direção '${direction}' inválida.`);

  const res = await execWasm(buffer, ['-vf', `perspective=${coords[direction]}:interpolation=linear`, '-f', 'mjpeg']);
  return { buffer: res, direction, strength: Math.round(s * 100), sizeKB: _sizeKB(res), type: 'perspective' };
}

// ─── Efeitos Visuais ──────────────────────────────────────────────────────────

export async function applyFilter(buffer, filterType, options = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const filters = {
    grayscale: 'format=gray',
    sepia:     'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    blur:      `gblur=sigma=${options.value || 5}`,
    vintage:   'curves=vintage,noise=alls=10,eq=contrast=1.1',
    edge:      'edgedetect=low=0.1:high=0.4',
    negative:  'negate',
    mirror:    options.vertical ? 'vflip' : 'hflip',
    pixelate:  (() => { const p = options.value || 10; return `scale=iw/${p}:-1,scale=iw*${p}:-1:flags=neighbor`; })(),
  };

  if (!filters[filterType]) throw new Error(`Filtro '${filterType}' não suportado.`);
  const res = await execWasm(buffer, ['-vf', filters[filterType], '-f', 'mjpeg']);
  return res;
}

export async function glitch(buffer, { strength = 10, mode = 'rgb' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(1, Math.min(50, strength));
  const filters = {
    rgb:  `rgbashift=rh=${s}:bh=-${s}:rv=${Math.floor(s/2)}:bv=-${Math.floor(s/2)}`,
    scan: `noise=alls=${s*2}:allf=t+u,lagfun=decay=0.9`,
    full: `rgbashift=rh=${s}:bh=-${s},noise=alls=${Math.floor(s*1.5)}:allf=t+u`,
  };
  if (!filters[mode]) throw new Error(`Modo '${mode}' inválido.`);

  const res = await execWasm(buffer, ['-vf', filters[mode], '-f', 'mjpeg']);
  return { buffer: res, strength: s, mode, sizeKB: _sizeKB(res), type: 'glitch' };
}

export async function sketch(buffer, { mode = 'pencil', strength = 5 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(1, Math.min(10, strength));
  const filters = {
    pencil:   `format=gray,edgedetect=low=${0.05*s}:high=${0.15*s}:mode=wires,negate`,
    ink:      `format=gray,edgedetect=low=${0.08*s}:high=${0.2*s}:mode=colormix,eq=contrast=${1+s*0.2},negate`,
    charcoal: `format=gray,unsharp=${3+s}:${3+s}:${s*0.5},noise=alls=${s*3}:allf=u,eq=contrast=${1+s*0.15}:brightness=-0.1`,
  };
  if (!filters[mode]) throw new Error(`Modo '${mode}' inválido.`);

  const res = await execWasm(buffer, ['-vf', filters[mode], '-f', 'mjpeg']);
  return { buffer: res, mode, strength: s, sizeKB: _sizeKB(res), type: 'sketch' };
}

export async function cartoon(buffer, { colors = 6, edges = 4 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const sc = Math.max(2, Math.min(16, colors));
  const se = Math.max(0, Math.min(10, edges));
  const filter = `eq=saturation=${1.5+se*0.1}:contrast=1.1,gblur=sigma=0.8,posterize=levels=${sc},unsharp=5:5:${se*0.3}:5:5:0`;

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, colors: sc, edges: se, sizeKB: _sizeKB(res), type: 'cartoon' };
}

export async function emboss(buffer, { mode = 'gray', strength = 5, direction = 'tl' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s = Math.max(1, Math.min(10, strength));
  const kernels = {
    tl: `-${s} -${s} 0 -${s} 0 ${s} 0 ${s} ${s}`,
    tr: `0 -${s} -${s} ${s} 0 -${s} ${s} ${s} 0`,
    bl: `0 ${s} ${s} -${s} 0 ${s} -${s} -${s} 0`,
    br: `${s} ${s} 0 ${s} 0 -${s} 0 -${s} -${s}`,
  };
  if (!kernels[direction]) throw new Error(`Direção '${direction}' inválida.`);

  const filters = [];
  if (mode === 'gray') filters.push('format=gray');
  filters.push(`convolution='${kernels[direction]}':'${kernels[direction]}':'${kernels[direction]}':'${kernels[direction]}':1:1:1:1:128:128:128:128`);
  filters.push(`eq=contrast=${1+s*0.1}`);

  const res = await execWasm(buffer, ['-vf', filters.join(','), '-f', 'mjpeg']);
  return { buffer: res, mode, strength: s, direction, sizeKB: _sizeKB(res), type: 'emboss' };
}

export async function duotone(buffer, {
  shadow = '#1a1a2e', highlight = '#e94560', strength = 0.85
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const s  = _hexToNorm(shadow);
  const h  = _hexToNorm(highlight);
  const bl = Math.max(0, Math.min(1, strength));
  const filter = `format=gray,format=rgb24,curves=r='0/${s.r} 1/${h.r}':g='0/${s.g} 1/${h.g}':b='0/${s.b} 1/${h.b}',eq=saturation=${bl*2}`;

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, shadow, highlight, strength: bl, sizeKB: _sizeKB(res), type: 'duotone' };
}

// ─── Composição ───────────────────────────────────────────────────────────────

export async function border(buffer, { thickness = 10, color = 'white', style = 'solid' } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const t = Math.max(1, Math.min(200, thickness));
  const filters = {
    solid:  `pad=iw+${t*2}:ih+${t*2}:${t}:${t}:${color}`,
    double: `pad=iw+${t*2}:ih+${t*2}:${t}:${t}:${color},pad=iw+${Math.floor(t*0.3)*2}:ih+${Math.floor(t*0.3)*2}:${Math.floor(t*0.3)}:${Math.floor(t*0.3)}:black@0.3`,
    shadow: `pad=iw+${t*2}:ih+${t*2}:${t}:${t}:${color},pad=iw+${t}:ih+${t}:0:0:black@0.4`,
  };
  if (!filters[style]) throw new Error(`Estilo '${style}' inválido.`);

  const res = await execWasm(buffer, ['-vf', filters[style], '-f', 'mjpeg']);
  return { buffer: res, thickness: t, color, style, sizeKB: _sizeKB(res), type: 'border' };
}

export async function shadow(buffer, {
  blur = 15, offsetX = 8, offsetY = 8, opacity = 0.6, background = 'white'
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const sb = Math.max(1, Math.min(50, blur));
  const so = Math.max(0, Math.min(1, opacity));
  const padding = sb * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY));
  const filter = `pad=iw+${padding*2}:ih+${padding*2}:${padding}:${padding}:${background},vignette=angle=PI/3,eq=contrast=1.05:brightness=-${so*0.05}`;

  const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
  return { buffer: res, blur: sb, offsetX, offsetY, opacity: so, sizeKB: _sizeKB(res), type: 'shadow' };
}

export async function overlay(base, over, {
  opacity = 1, position = 'center', x = null, y = null, scale = 1
} = {}) {
  if (!Buffer.isBuffer(base) || !Buffer.isBuffer(over)) throw new Error('base e over devem ser Buffers válidos.');

  const so = Math.max(0, Math.min(1, opacity));
  const ss = Math.max(0.1, Math.min(2.0, scale));
  const posMap = {
    'center':       '(main_w-overlay_w)/2:(main_h-overlay_h)/2',
    'top-left':     '10:10',
    'top-right':    'main_w-overlay_w-10:10',
    'bottom-left':  '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
  };
  const posStr = (x !== null && y !== null) ? `${x}:${y}` : (posMap[position] || posMap['center']);
  const scaleF = ss !== 1 ? `[1:v]scale=iw*${ss}:ih*${ss}[scaled];[scaled]` : '[1:v]';

  const res = await execWasmMulti(
    [{ name: 'base.jpg', buffer: base }, { name: 'over.png', buffer: over }],
    ['-filter_complex', `${scaleF}format=rgba,colorchannelmixer=aa=${so}[top];[0:v][top]overlay=${posStr}[out]`, '-map', '[out]', '-f', 'mjpeg'],
    'output.jpg'
  );
  return { buffer: res, opacity: so, position: (x !== null && y !== null) ? `custom(${x},${y})` : position, scale: ss, sizeKB: _sizeKB(res), type: 'overlay' };
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

export async function noise(buffer, { strength = 25, type = 'film', color = false } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');

  const ss = Math.max(1, Math.min(100, strength));
  const flags = color ? 'a' : 'u';
  const filterMap = {
    film:    `noise=alls=${ss}:allf=${flags}+t`,
    digital: `noise=alls=${ss}:allf=${flags}`,
    soft:    `noise=alls=${Math.round(ss*0.6)}:allf=${flags},gblur=sigma=0.5`,
  };
  if (!filterMap[type]) throw new Error(`Tipo '${type}' não suportado.`);

  const res = await execWasm(buffer, ['-vf', filterMap[type], '-f', 'mjpeg']);
  return { buffer: res, strength: ss, type, color, sizeKB: _sizeKB(res), effect: 'noise' };
}

export async function dominant(buffer, { count = 5, quality = 5 } = {}) {
  // dominant() usa análise de pixels em JS puro — não precisa de WASM diferente
  // Delegamos para a versão nativa que já é pura JS (K-Means em memória)
  const { dominant: nativeDominant } = await import('./dominant.js');
  return nativeDominant(buffer, { count, quality });
}

export async function strip(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');
  const res = await execWasm(buffer, ['-map_metadata', '-1', '-f', 'mjpeg']);
  return { buffer: res, originalSizeKB: _sizeKB(buffer), sizeKB: _sizeKB(res), saved: _sizeKB(buffer) - _sizeKB(res), type: 'stripped' };
}

export async function watermark(buffer, {
  text = '', logo = null, position = 'bottom-right', opacity = 0.5, fontSize = 40, color = 'white'
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input deve ser um Buffer válido');

  if (logo && Buffer.isBuffer(logo)) {
    const so = Math.max(0, Math.min(1, opacity));
    const posMap = {
      'top-left':     '10:10',
      'top-right':    'main_w-overlay_w-10:10',
      'bottom-left':  '10:main_h-overlay_h-10',
      'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
      'center':       '(main_w-overlay_w)/2:(main_h-overlay_h)/2',
    };
    const [px, py] = (posMap[position] || posMap['bottom-right']).split(':');
    const res = await execWasmMulti(
      [{ name: 'base.jpg', buffer }, { name: 'logo.png', buffer: logo }],
      ['-filter_complex', `[1:v]format=rgba,colorchannelmixer=aa=${so}[logo];[0:v][logo]overlay=${px}:${py}[out]`, '-map', '[out]', '-f', 'mjpeg'],
      'output.jpg'
    );
    return { buffer: res, type: 'watermark', mode: 'logo', appliedAt: new Date().toISOString() };
  }

  if (text) {
    // Nota: drawtext com fontfile customizado não funciona bem em WASM sem embed da fonte.
    // Usamos fonte padrão disponível no core WASM.
    const so = Math.max(0, Math.min(1, opacity));
    const xPos = position.includes('right') ? 'w-tw-30' : position.includes('left') ? '30' : '(w-tw)/2';
    const yPos = position.includes('bottom') ? 'h-th-30' : position.includes('top') ? '30' : '(h-th)/2';
    const filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${color}@${so}:x=${xPos}:y=${yPos}:shadowcolor=black@0.4:shadowx=2:shadowy=2`;
    const res = await execWasm(buffer, ['-vf', filter, '-f', 'mjpeg']);
    return { buffer: res, type: 'watermark', mode: 'text', appliedAt: new Date().toISOString() };
  }

  return { buffer, type: 'watermark', mode: 'none', appliedAt: new Date().toISOString() };
}

export async function circle(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');
  const filter = 'scale=500:500:force_original_aspect_ratio=increase,crop=500:500,format=rgba,vignette=pi/4,lutyuv=y=\'if(gt(val,128),255,0)\'';
  const res = await execWasm(buffer, ['-vf', filter, '-vcodec', 'png', '-pix_fmt', 'rgba'], 'jpg', 'png');
  return { buffer: res, format: 'png', sizeKB: _sizeKB(res), type: 'circle' };
}

// ─── Animação ─────────────────────────────────────────────────────────────────

export async function gif(frames, { fps = 10, width = 480, loop = 0, dither = true } = {}) {
  if (!Array.isArray(frames) || frames.length < 2) throw new Error('gif() requer ao menos 2 frames.');

  const safeFps   = Math.max(1, Math.min(30, fps));
  const safeWidth = width === -1 ? -1 : Math.max(64, Math.min(1920, width));

  const inputs = frames.map((buf, i) => ({ name: `frame_${String(i).padStart(4,'0')}.jpg`, buffer: buf }));
  const concatList = inputs.map(({ name }) => `file '${name}'`).join('\n');
  const listBuf = Buffer.from(concatList, 'utf-8');
  inputs.push({ name: 'list.txt', buffer: listBuf });

  const filterArgs = dither
    ? ['-filter_complex', `scale=${safeWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[palette];[s1][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`]
    : ['-vf', `scale=${safeWidth}:-1:flags=lanczos`];

  const res = await execWasmMulti(
    inputs,
    ['-f', 'concat', '-safe', '0', '-i', 'list.txt', ...filterArgs, '-loop', String(loop), '-r', String(safeFps), '-f', 'gif'],
    'output.gif'
  );
  return { buffer: res, frames: frames.length, fps: safeFps, width: safeWidth, loop, sizeKB: _sizeKB(res), format: 'gif', type: 'animated' };
}

export async function speed(buffer, { factor = 2 } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('O input deve ser um Buffer válido.');
  const sf = Math.max(0.1, Math.min(10, factor));
  const res = await execWasm(
    buffer,
    ['-vf', `setpts=${(1/sf).toFixed(4)}*PTS`, '-f', 'gif'],
    'gif', 'gif'
  );
  return { buffer: res, factor: sf, sizeKB: _sizeKB(res), format: 'gif', type: 'speed' };
}

// ─── Collage ──────────────────────────────────────────────────────────────────

export async function collage(buffers, {
  columns = 2, cellWidth = 400, cellHeight = 400, gap = 0, background = 'black', fit = 'cover'
} = {}) {
  if (!Array.isArray(buffers) || buffers.length < 2) throw new Error('collage() requer ao menos 2 imagens.');

  const count = buffers.length;
  const cols  = Math.min(columns, count);
  const rows  = Math.ceil(count / cols);
  const totalW = cols * cellWidth + (cols - 1) * gap;
  const totalH = rows * cellHeight + (rows - 1) * gap;

  const inputs = buffers.map((buf, i) => ({ name: `img_${i}.jpg`, buffer: buf }));
  const filterParts = [];

  for (let i = 0; i < count; i++) {
    const scaleF = fit === 'cover'
      ? `scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=increase,crop=${cellWidth}:${cellHeight}`
      : `scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=decrease,pad=${cellWidth}:${cellHeight}:(ow-iw)/2:(oh-ih)/2:${background}`;
    filterParts.push(`[${i}:v]${scaleF}[cell${i}]`);
  }

  filterParts.push(`color=c=${background}:size=${totalW}x${totalH}:rate=1[canvas]`);

  let current = 'canvas';
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const out = i === count - 1 ? 'out' : `tmp${i}`;
    filterParts.push(`[${current}][cell${i}]overlay=x=${col*(cellWidth+gap)}:y=${row*(cellHeight+gap)}[${out}]`);
    current = out;
  }

  const inputArgs = inputs.flatMap(({ name }) => ['-i', name]);
  const res = await execWasmMulti(
    inputs,
    [...inputArgs, '-filter_complex', filterParts.join(';'), '-map', '[out]', '-frames:v', '1', '-f', 'mjpeg'],
    'output.jpg'
  );
  return { buffer: res, width: totalW, height: totalH, columns: cols, rows, count, sizeKB: _sizeKB(res), type: 'collage' };
}

// ─── Re-exports puros JS (não precisam de WASM) ───────────────────────────────

export { toBase64, fromBase64, getInfo, placeholder } from './utils.js';