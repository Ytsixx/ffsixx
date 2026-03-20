#!/usr/bin/env node

/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx CLI ───────────────────────────────────────────────────────────────
 * Ferramenta de terminal para manipulação de imagens via ffsixx.
 *
 * Uso:
 *   npx ffsixx <comando> <arquivo> [opções]
 *   ffsixx <comando> <arquivo> [opções]        (após npm i -g ffsixx)
 *
 * Exemplos:
 *   npx ffsixx resize foto.jpg --width 800 --fit cover
 *   npx ffsixx compress foto.jpg --max-size 200
 *   npx ffsixx convert foto.jpg --format webp --quality 85
 *   npx ffsixx sticker foto.jpg
 *   npx ffsixx filter foto.jpg --type grayscale
 *   npx ffsixx watermark foto.jpg --text "© 2025" --position bottom-right
 *   npx ffsixx batch "*.jpg" resize --width 800   (glob)
 *   npx ffsixx info foto.jpg
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { resolve, extname, basename, dirname, join } from 'path';
import { createInterface } from 'readline';

// ─── Cores ANSI (sem dependências) ───────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  gray:   '\x1b[90m',
};

const ok    = str => `${c.green}✓${c.reset} ${str}`;
const fail  = str => `${c.red}✗${c.reset} ${str}`;
const info  = str => `${c.cyan}ℹ${c.reset} ${str}`;
const warn  = str => `${c.yellow}⚠${c.reset} ${str}`;
const bold  = str => `${c.bold}${str}${c.reset}`;
const dim   = str => `${c.dim}${str}${c.reset}`;

// ─── Parser de args simples (sem dependências) ────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  let i = 0;

  while (i < argv.length) {
    const token = argv[i];

    if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      const next = argv[i + 1];

      if (!next || next.startsWith('--')) {
        args[key] = true; // flag booleana
      } else {
        // Tenta converter para número
        args[key] = isNaN(Number(next)) ? next : Number(next);
        i++;
      }
    } else {
      args._.push(token);
    }
    i++;
  }

  return args;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function getOutputPath(inputPath, suffix = '', ext = null) {
  const dir  = dirname(inputPath);
  const base = basename(inputPath, extname(inputPath));
  const outExt = ext || extname(inputPath);
  return join(dir, `${base}${suffix}${outExt}`);
}

async function loadImage(filePath) {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  return readFile(resolved);
}

async function saveResult(result, outputPath) {
  const buffer = Buffer.isBuffer(result) ? result : result.buffer;
  await writeFile(outputPath, buffer);
  const sizeKB = Math.round(buffer.length / 1024);
  return { sizeKB, buffer };
}

function printResult(inputPath, outputPath, inputSize, outputSize, extra = {}) {
  const saved = inputSize - outputSize;
  const savedPct = ((saved / inputSize) * 100).toFixed(1);

  console.log(ok(`Salvo em: ${bold(outputPath)}`));
  console.log(dim(`   Entrada:  ${formatBytes(inputSize)}`));
  console.log(dim(`   Saída:    ${formatBytes(outputSize)}`));
  if (saved > 0) {
    console.log(dim(`   Economia: ${formatBytes(saved)} (${savedPct}%)`));
  }
  if (Object.keys(extra).length > 0) {
    for (const [k, v] of Object.entries(extra)) {
      console.log(dim(`   ${k}: ${v}`));
    }
  }
}

// ─── Comandos ─────────────────────────────────────────────────────────────────

const COMMANDS = {

  // ── resize ────────────────────────────────────────────────────────────────
  async resize(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_resized');
    const { resize } = await import('../src/resize.js');

    const buf = await loadImage(inputPath);
    const result = await resize(buf, {
      width:      args.width  || args.w || -1,
      height:     args.height || args.h || -1,
      fit:        args.fit    || 'cover',
      background: args.background || 'black',
      upscale:    args.upscale || false,
    });

    const { sizeKB } = await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Dimensões: `${result.width}x${result.height}`,
      Modo: result.fit || 'cover',
    });
  },

  // ── compress ──────────────────────────────────────────────────────────────
  async compress(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_compressed');
    const { compress } = await import('../src/compress.js');

    const buf = await loadImage(inputPath);
    const result = await compress(buf, {
      maxSizeKB: args.maxSize || args.maxSizeKB || 300,
      quality:   args.quality || args.q || 90,
      mode:      args.mode || 'balanced',
      format:    args.format || 'jpeg',
    });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Iterações: result.iterations,
      Sucesso:   result.success ? 'sim' : `não (melhor resultado: ${result.sizeKB}KB)`,
    });
  },

  // ── convert ───────────────────────────────────────────────────────────────
  async convert(args) {
    const [inputPath] = args._;
    const format = args.format || args.f || 'webp';
    const ext    = format === 'jpeg' ? '.jpg' : `.${format}`;
    const output = args.output || args.o || getOutputPath(inputPath, '', ext);
    const { convert } = await import('../src/convert.js');

    const buf    = await loadImage(inputPath);
    const result = await convert(buf, {
      format,
      quality: args.quality || args.q || 80,
    });

    const resBuf = Buffer.isBuffer(result) ? result : result.buffer;
    await writeFile(output, resBuf);
    printResult(inputPath, output, buf.length, resBuf.length, { Formato: format });
  },

  // ── crop ──────────────────────────────────────────────────────────────────
  async crop(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_cropped');
    const { crop } = await import('../src/crop.js');

    const buf = await loadImage(inputPath);
    const result = await crop(buf, {
      x:      args.x      || 0,
      y:      args.y      || 0,
      width:  args.width  || args.w || 200,
      height: args.height || args.h || 200,
    });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Área: `${result.width}x${result.height} @ (${result.x}, ${result.y})`,
    });
  },

  // ── rotate ────────────────────────────────────────────────────────────────
  async rotate(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_rotated');
    const { rotate } = await import('../src/rotate.js');

    const buf = await loadImage(inputPath);
    const result = await rotate(buf, {
      angle:      args.angle || args.a || 90,
      background: args.background || 'black',
      expand:     args.expand !== false,
    });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Ângulo: `${result.angle}°`,
    });
  },

  // ── watermark ─────────────────────────────────────────────────────────────
  async watermark(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_watermarked');
    const { watermark } = await import('../src/watermark.js');

    const buf = await loadImage(inputPath);
    const result = await watermark(buf, {
      text:       args.text || args.t || '',
      position:   args.position || args.p || 'bottom-right',
      opacity:    args.opacity || 0.5,
      fontSize:   args.fontSize || args.size || 40,
      color:      args.color || 'white',
    });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Modo: result.mode,
    });
  },

  // ── sticker ───────────────────────────────────────────────────────────────
  async sticker(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_sticker', '.webp');
    const { sticker } = await import('../src/sticker.js');

    const buf = await loadImage(inputPath);
    const result = await sticker(buf, { quality: args.quality || args.q || 80 });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Formato: 'WebP 512x512',
    });
  },

  // ── frame ─────────────────────────────────────────────────────────────────
  async frame(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_framed');
    const { frame } = await import('../src/frame.js');

    const buf = await loadImage(inputPath);
    const result = await frame(buf, {
      color:     args.color || 'white',
      thickness: args.thickness || args.t || 20,
    });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Moldura: `${args.thickness || 20}px ${args.color || 'white'}`,
    });
  },

  // ── filter ────────────────────────────────────────────────────────────────
  async filter(args) {
    const [inputPath] = args._;
    const type   = args.type || args.t || 'grayscale';
    const output = args.output || args.o || getOutputPath(inputPath, `_${type}`);
    const { applyFilter } = await import('../src/applyFilter.js');

    const buf    = await loadImage(inputPath);
    const result = await applyFilter(buf, type, { value: args.value || args.v });
    const resBuf = Buffer.isBuffer(result) ? result : result.buffer;

    await writeFile(output, resBuf);
    printResult(inputPath, output, buf.length, resBuf.length, { Filtro: type });
  },

  // ── adjust ────────────────────────────────────────────────────────────────
  async adjust(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_adjusted');
    const { adjust } = await import('../src/adjust.js');

    const buf = await loadImage(inputPath);
    const result = await adjust(buf, {
      brightness: args.brightness || 0,
      contrast:   args.contrast   || 1,
      saturation: args.saturation || 1,
      gamma:      args.gamma      || 1,
    });

    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── flip / flop ───────────────────────────────────────────────────────────
  async flip(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_flipped');
    const { flip } = await import('../src/mirror.js');
    const buf = await loadImage(inputPath);
    const result = await flip(buf);
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, { Modo: 'horizontal' });
  },

  async flop(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_flopped');
    const { flop } = await import('../src/mirror.js');
    const buf = await loadImage(inputPath);
    const result = await flop(buf);
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, { Modo: 'vertical' });
  },

  // ── sharpen ───────────────────────────────────────────────────────────────
  async sharpen(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_sharpened');
    const { sharpen } = await import('../src/sharpen.js');
    const buf = await loadImage(inputPath);
    const result = await sharpen(buf, {
      strength: args.strength || 1.5,
      radius:   args.radius   || 5,
      mode:     args.mode     || 'sharpen',
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── blur ──────────────────────────────────────────────────────────────────
  async blur(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_blurred');
    const { sharpen } = await import('../src/sharpen.js');
    const buf = await loadImage(inputPath);
    const result = await sharpen(buf, { mode: 'blur', strength: args.sigma || args.strength || 3 });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── glitch ────────────────────────────────────────────────────────────────
  async glitch(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_glitch');
    const { glitch } = await import('../src/glitch.js');
    const buf = await loadImage(inputPath);
    const result = await glitch(buf, {
      strength: args.strength || 10,
      mode:     args.mode     || 'rgb',
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, { Modo: result.mode });
  },

  // ── sketch ────────────────────────────────────────────────────────────────
  async sketch(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_sketch');
    const { sketch } = await import('../src/sketch.js');
    const buf = await loadImage(inputPath);
    const result = await sketch(buf, {
      mode:     args.mode     || 'pencil',
      strength: args.strength || 5,
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, { Modo: result.mode });
  },

  // ── cartoon ───────────────────────────────────────────────────────────────
  async cartoon(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_cartoon');
    const { cartoon } = await import('../src/cartoon.js');
    const buf = await loadImage(inputPath);
    const result = await cartoon(buf, { colors: args.colors || 6, edges: args.edges || 4 });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── emboss ────────────────────────────────────────────────────────────────
  async emboss(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_emboss');
    const { emboss } = await import('../src/emboss.js');
    const buf = await loadImage(inputPath);
    const result = await emboss(buf, {
      mode:      args.mode      || 'gray',
      strength:  args.strength  || 5,
      direction: args.direction || 'tl',
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── duotone ───────────────────────────────────────────────────────────────
  async duotone(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_duotone');
    const { duotone } = await import('../src/duotone.js');
    const buf = await loadImage(inputPath);
    const result = await duotone(buf, {
      shadow:    args.shadow    || '#1a1a2e',
      highlight: args.highlight || '#e94560',
      strength:  args.strength  || 0.85,
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── vignette ──────────────────────────────────────────────────────────────
  async vignette(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_vignette');
    const { vignette } = await import('../src/vignette.js');
    const buf = await loadImage(inputPath);
    const result = await vignette(buf, { angle: args.angle || 20, strength: args.strength || 0.5 });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── border ────────────────────────────────────────────────────────────────
  async border(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_bordered');
    const { border } = await import('../src/border.js');
    const buf = await loadImage(inputPath);
    const result = await border(buf, {
      thickness: args.thickness || 10,
      color:     args.color     || 'white',
      style:     args.style     || 'solid',
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── shadow ────────────────────────────────────────────────────────────────
  async shadow(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_shadow');
    const { shadow } = await import('../src/shadow.js');
    const buf = await loadImage(inputPath);
    const result = await shadow(buf, {
      blur:       args.blur       || 15,
      offsetX:    args.offsetX    || 8,
      offsetY:    args.offsetY    || 8,
      opacity:    args.opacity    || 0.6,
      background: args.background || 'white',
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── noise ─────────────────────────────────────────────────────────────────
  async noise(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_noise');
    const { noise } = await import('../src/noise.js');
    const buf = await loadImage(inputPath);
    const result = await noise(buf, {
      strength: args.strength || 25,
      type:     args.type     || 'film',
      color:    args.color    || false,
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, { Tipo: result.type });
  },

  // ── circle ────────────────────────────────────────────────────────────────
  async circle(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_circle', '.png');
    const { circle } = await import('../src/circle.js');
    const buf = await loadImage(inputPath);
    const result = await circle(buf);
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, { Formato: 'PNG com transparência' });
  },

  // ── perspective ───────────────────────────────────────────────────────────
  async perspective(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_perspective');
    const { perspective } = await import('../src/perspective.js');
    const buf = await loadImage(inputPath);
    const result = await perspective(buf, {
      direction: args.direction || 'right',
      strength:  args.strength  || 30,
    });
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length);
  },

  // ── dominant ──────────────────────────────────────────────────────────────
  async dominant(args) {
    const [inputPath] = args._;
    const { dominant } = await import('../src/dominant.js');
    const buf = await loadImage(inputPath);
    const result = await dominant(buf, { count: args.count || 5 });

    console.log(bold(`
Cores dominantes de: ${inputPath}`));
    for (const color of result.colors) {
      const swatch = `\x1b[48;2;${color.rgb.r};${color.rgb.g};${color.rgb.b}m   \x1b[0m`;
      console.log(`  ${swatch}  ${color.hex}  ${dim(`rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`)}`);
    }
  },

  // ── info ──────────────────────────────────────────────────────────────────
  async info(args) {
    const [inputPath] = args._;
    const buf = await loadImage(inputPath);
    const ext = extname(inputPath).toLowerCase();
    const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.3gp'];

    if (videoExts.includes(ext)) {
      const { videoInfo } = await import('../src/video.js');
      const result = await videoInfo(buf);
      console.log(bold(`\nInfo: ${inputPath}`));
      console.log(`  Tipo:       vídeo`);
      console.log(`  Codec:      ${result.codec}`);
      console.log(`  Dimensões:  ${result.width}x${result.height}`);
      console.log(`  Duração:    ${result.duration}s`);
      console.log(`  FPS:        ${result.fps}`);
      console.log(`  Bitrate:    ${result.bitrate} kbps`);
      console.log(`  Tamanho:    ${result.sizeKB}KB (${result.sizeMB}MB)`);
    } else {
      const { getInfo } = await import('../src/utils.js');
      const result = getInfo(buf);
      console.log(bold(`\nInfo: ${inputPath}`));
      console.log(`  Tipo:       imagem`);
      console.log(`  Dimensões:  ${result.width}x${result.height}`);
      console.log(`  Formato:    ${result.format}`);
      console.log(`  Tamanho:    ${result.sizeKB}KB (${result.sizeMB}MB)`);
      console.log(`  Megapixels: ${result.megapixels}MP`);
      console.log(`  Aspect:     ${result.aspectRatio}`);
      console.log(`  Orientação: ${result.isLandscape ? 'paisagem' : result.isPortrait ? 'retrato' : 'quadrado'}`);
    }
  },

  // ── strip ─────────────────────────────────────────────────────────────────
  async strip(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_stripped');
    const { strip } = await import('../src/utils.js');
    const buf = await loadImage(inputPath);
    const result = await strip(buf);
    await saveResult(result, output);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      'EXIF removido': `${result.saved}KB economizados`,
    });
  },

  // ── gif ───────────────────────────────────────────────────────────────────
  async gif(args) {
    const inputs = args._;
    if (inputs.length < 2) {
      throw new Error(`gif requer ao menos 2 arquivos de entrada.\nUso: ffsixx gif frame1.jpg frame2.jpg ... --fps 10`);
    }
    const output = args.output || args.o || 'output.gif';
    const { gif } = await import('../src/gif.js');

    const frames = await Promise.all(inputs.map(loadImage));
    const result = await gif(frames, {
      fps:    args.fps   || 10,
      width:  args.width || 480,
      loop:   args.loop  || 0,
      dither: args.dither !== false,
    });

    await writeFile(output, result.buffer);
    console.log(ok(`GIF salvo: ${bold(output)}`));
    console.log(dim(`   Frames: ${result.frames} | FPS: ${result.fps} | Tamanho: ${result.sizeKB}KB`));
  },

  // ── batch ─────────────────────────────────────────────────────────────────
  async batch(args) {
    const [pattern, command] = args._;
    if (!pattern || !command) {
      throw new Error(`Uso: ffsixx batch <padrão> <comando> [opções]\nEx:  ffsixx batch "*.jpg" resize --width 800`);
    }

    // Resolve glob simples (só *.ext no diretório atual)
    let files = [];
    if (pattern.includes('*')) {
      const dir = dirname(pattern) === '.' ? '.' : dirname(pattern);
      const ext = extname(pattern).toLowerCase();
      const all = await readdir(resolve(dir));
      files = all
        .filter(f => f.toLowerCase().endsWith(ext))
        .map(f => join(dir, f));
    } else {
      files = [pattern];
    }

    if (files.length === 0) {
      throw new Error(`Nenhum arquivo encontrado para o padrão: ${pattern}`);
    }

    if (!COMMANDS[command]) {
      throw new Error(`Comando '${command}' não reconhecido.`);
    }

    console.log(info(`Processando ${bold(String(files.length))} arquivos com ${bold(command)}...`));
    console.log(dim(`Concorrência: ${cpus().length} núcleos`));
    console.log('');

    let done = 0;
    const errors = [];

    await Promise.all(
      files.map(async file => {
        try {
          await COMMANDS[command]({ _: [file], ...args, _cmd: undefined });
          done++;
        } catch (err) {
          errors.push({ file, error: err.message });
          console.log(fail(`${file}: ${err.message}`));
        }
      })
    );

    console.log('');
    console.log(ok(`Concluído: ${done}/${files.length} arquivos processados`));
    if (errors.length > 0) {
      console.log(warn(`${errors.length} erro(s) encontrado(s)`));
    }
  },
  // ── compress-video ────────────────────────────────────────────────────────
  async ['compress-video'](args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_compressed', '.mp4');
    const { compressVideo } = await import('../src/video.js');

    console.log(info(`Comprimindo vídeo... (pode demorar)`));
    const buf = await loadImage(inputPath);
    const result = await compressVideo(buf, {
      crf:      args.crf     || 28,
      preset:   args.preset  || 'fast',
      codec:    args.codec   || 'h264',
      hwaccel:  args.hwaccel || 'auto',
      maxSizeMB: args.maxSize || null,
      onProgress: ({ percent, stage }) => {
        process.stdout.write(`\r   ${dim(stage + '... ' + percent + '%')}   `);
      },
    });
    process.stdout.write('\n');
    await writeFile(output, result.buffer);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Codec:   result.codec,
      Backend: result.backend,
      CRF:     result.crf,
    });
  },

  // ── thumbnail ─────────────────────────────────────────────────────────────
  async thumbnail(args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_thumb', '.jpg');
    const { thumbnail } = await import('../src/video.js');

    const buf = await loadImage(inputPath);
    const result = await thumbnail(buf, {
      at:      args.at      || args.t  || 1,
      width:   args.width   || args.w  || -1,
      height:  args.height  || args.h  || -1,
      quality: args.quality || args.q  || 85,
    });
    await writeFile(output, result.buffer);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Segundo: result.at + 's',
    });
  },

  // ── video-to-gif ──────────────────────────────────────────────────────────
  async ['video-to-gif'](args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '', '.gif');
    const { videoToGif } = await import('../src/video.js');

    console.log(info(`Convertendo para GIF...`));
    const buf = await loadImage(inputPath);
    const result = await videoToGif(buf, {
      start:    args.start    || 0,
      duration: args.duration || args.d || 3,
      fps:      args.fps      || 12,
      width:    args.width    || args.w || 480,
      dither:   args.dither   !== false,
    });
    await writeFile(output, result.buffer);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Duração: result.duration + 's',
      FPS:     result.fps,
    });
  },

  // ── video-speed ───────────────────────────────────────────────────────────
  async ['video-speed'](args) {
    const [inputPath] = args._;
    const output = args.output || args.o || getOutputPath(inputPath, '_speed', '.mp4');
    const { videoSpeed } = await import('../src/video.js');

    const buf = await loadImage(inputPath);
    const result = await videoSpeed(buf, {
      factor:    args.factor || args.f || 2,
      keepAudio: args.audio  !== false,
    });
    await writeFile(output, result.buffer);
    printResult(inputPath, output, buf.length, result.buffer.length, {
      Fator: result.factor + 'x',
    });
  },

  // ── extract-frames ────────────────────────────────────────────────────────
  async ['extract-frames'](args) {
    const [inputPath] = args._;
    const { extractFrames } = await import('../src/video.js');

    const buf = await loadImage(inputPath);
    console.log(info(`Extraindo frames...`));
    const result = await extractFrames(buf, {
      fps:       args.fps       || 1,
      start:     args.start     || 0,
      duration:  args.duration  || null,
      maxFrames: args.max       || null,
      width:     args.width     || args.w || -1,
    });

    // Salva cada frame
    const dir = args.output || args.o || './frames';
    const { mkdir } = await import('fs/promises');
    await mkdir(dir, { recursive: true });

    for (let i = 0; i < result.frames.length; i++) {
      const name = join(dir, `frame_${String(i + 1).padStart(4, '0')}.jpg`);
      await writeFile(name, result.frames[i]);
    }

    console.log(ok(`${result.count} frames extraídos em: ${bold(dir)}`));
    console.log(dim(`   FPS: ${result.fps} | Total: ${result.sizeKB}KB`));
    console.log(dim(`   Tempo: ${Date.now()}ms`));
  },


};

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(command = null) {
  if (command && COMMANDS[command]) {
    const helps = {
      resize:      'ffsixx resize <arquivo> --width 800 --height 600 --fit cover|contain|fill',
      compress:    'ffsixx compress <arquivo> --max-size 200 --quality 90 --mode fast|balanced|precise',
      convert:     'ffsixx convert <arquivo> --format webp|jpeg|png --quality 85',
      crop:        'ffsixx crop <arquivo> --x 0 --y 0 --width 200 --height 200',
      rotate:      'ffsixx rotate <arquivo> --angle 90 --background black',
      watermark:   'ffsixx watermark <arquivo> --text "© 2025" --position bottom-right --opacity 0.5',
      sticker:     'ffsixx sticker <arquivo> --quality 80',
      frame:       'ffsixx frame <arquivo> --color white --thickness 20',
      filter:      'ffsixx filter <arquivo> --type grayscale|sepia|blur|vintage|edge|negative|pixelate',
      adjust:      'ffsixx adjust <arquivo> --brightness 0.1 --contrast 1.2 --saturation 1.5',
      glitch:      'ffsixx glitch <arquivo> --strength 10 --mode rgb|scan|full',
      sketch:      'ffsixx sketch <arquivo> --mode pencil|ink|charcoal --strength 5',
      cartoon:     'ffsixx cartoon <arquivo> --colors 6 --edges 4',
      emboss:      'ffsixx emboss <arquivo> --mode gray|color --direction tl|tr|bl|br',
      duotone:     'ffsixx duotone <arquivo> --shadow "#1a1a2e" --highlight "#e94560"',
      vignette:    'ffsixx vignette <arquivo> --angle 20 --strength 0.5',
      border:      'ffsixx border <arquivo> --thickness 10 --color white --style solid|double|shadow',
      shadow:      'ffsixx shadow <arquivo> --blur 15 --opacity 0.6 --background white',
      noise:       'ffsixx noise <arquivo> --strength 25 --type film|digital|soft',
      circle:      'ffsixx circle <arquivo>',
      perspective: 'ffsixx perspective <arquivo> --direction left|right|top|bottom --strength 30',
      dominant:    'ffsixx dominant <arquivo> --count 5',
      info:        'ffsixx info <arquivo>',
      strip:       'ffsixx strip <arquivo>',
      flip:        'ffsixx flip <arquivo>',
      flop:        'ffsixx flop <arquivo>',
      sharpen:     'ffsixx sharpen <arquivo> --strength 1.5 --mode sharpen|blur',
      blur:        'ffsixx blur <arquivo> --sigma 3',
      gif:              'ffsixx gif frame1.jpg frame2.jpg ... --fps 10 --width 480',
      'compress-video':  'ffsixx compress-video <video.mp4> --crf 28 --max-size 2',
      thumbnail:         'ffsixx thumbnail <video.mp4> --at 5 --width 480',
      'video-to-gif':    'ffsixx video-to-gif <video.mp4> --start 0 --duration 3 --fps 12',
      'video-speed':     'ffsixx video-speed <video.mp4> --factor 2',
      'extract-frames':  'ffsixx extract-frames <video.mp4> --fps 1 --output ./frames',
      batch:       'ffsixx batch "*.jpg" <comando> [opções do comando]',
    };
    console.log(`
${bold('Uso:')} ${helps[command] || command}`);
    console.log(dim('Use --output <caminho> para definir o arquivo de saída.'));
    return;
  }

  console.log(`
${bold('ffsixx')} ${c.cyan}v1.5.0${c.reset} — Manipulação de imagens no terminal

${bold('Uso:')}
  ffsixx <comando> <arquivo> [opções]
  npx ffsixx <comando> <arquivo> [opções]

${bold('Comandos:')}
  ${c.green}Core${c.reset}
  resize      Redimensionar imagem
  compress    Comprimir para tamanho alvo
  convert     Converter formato (jpg/png/webp)
  crop        Recortar área da imagem
  sticker     Gerar sticker WhatsApp (WebP 512x512)
  watermark   Adicionar marca d'água (texto ou logo)
  frame       Adicionar moldura

  ${c.green}Transformações${c.reset}
  rotate      Rotacionar
  flip        Espelhar horizontalmente
  flop        Espelhar verticalmente
  sharpen     Nitidez
  blur        Desfoque
  adjust      Brilho, contraste, saturação, gama
  vignette    Escurecimento nas bordas
  perspective Distorção de perspectiva

  ${c.green}Efeitos Visuais${c.reset}
  filter      Filtros: grayscale, sepia, blur, vintage, edge, negative, pixelate
  glitch      Efeito glitch digital
  sketch      Estilo lápis/carvão
  cartoon     Estilo desenho animado
  emboss      Relevo
  duotone     Duotone duas cores
  noise       Granulado/ruído
  border      Borda customizada
  shadow      Sombra projetada
  circle      Recorte circular (PNG com transparência)

  ${c.green}Utilitários${c.reset}
  info        Exibir metadados da imagem
  dominant    Extrair cores dominantes
  strip       Remover metadados EXIF
  gif         Criar GIF animado de múltiplos frames

  ${c.green}Vídeo${c.reset}
  compress-video  Comprimir vídeo (ex: 4MB → 1MB)
  thumbnail       Extrair frame como imagem
  video-to-gif    Converter trecho em GIF
  video-speed     Acelerar ou desacelerar vídeo
  extract-frames  Extrair frames como JPEGs

  ${c.green}Batch${c.reset}
  batch       Processar múltiplos arquivos: ffsixx batch "*.jpg" resize --width 800

${bold('Opções globais:')}
  --output, -o  Arquivo de saída
  --help, -h    Ajuda do comando específico

${dim('Exemplos:')}
  ${dim('ffsixx resize foto.jpg --width 800 --fit cover')}
  ${dim('ffsixx compress foto.jpg --max-size 150')}
  ${dim('ffsixx convert foto.jpg --format webp')}
  ${dim('ffsixx filter foto.jpg --type grayscale')}
  ${dim('ffsixx batch "*.jpg" sticker')}
  ${dim('ffsixx compress-video video.mp4 --crf 32')}
  ${dim('ffsixx thumbnail video.mp4 --at 5')}
  ${dim('ffsixx video-to-gif video.mp4 --duration 3')}
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const [command, ...rest] = argv;
  const args = parseArgs(rest);

  if (args.help || args.h) {
    printHelp(command);
    process.exit(0);
  }

  if (!COMMANDS[command]) {
    console.error(fail(`Comando desconhecido: ${bold(command)}`));
    console.error(dim('Use ffsixx --help para ver todos os comandos.'));
    process.exit(1);
  }

  if (command !== 'batch' && command !== 'gif' && command !== 'dominant' && command !== 'info' && command !== 'extract-frames' && args._.length === 0) {
    console.error(fail(`Nenhum arquivo especificado.`));
    printHelp(command);
    process.exit(1);
  }

  try {
    const start = Date.now();
    await COMMANDS[command](args);
    const ms = Date.now() - start;
    console.log(dim(`   Tempo: ${ms}ms`));
  } catch (err) {
    console.error(fail(err.message));
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

// Import necessário para o batch
import { cpus } from 'os';

main();