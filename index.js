/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

// ─── Core ────────────────────────────────────────────────────────────────────
import { compress }    from './src/compress.js';
import { resize }      from './src/resize.js';
import resizeCover     from './src/resizeCover.js';
import { watermark }   from './src/watermark.js';
import { crop }        from './src/crop.js';
import { flip, flop }  from './src/mirror.js';
import { applyFilter } from './src/applyFilter.js';
import { sticker }     from './src/sticker.js';
import { frame }       from './src/frame.js';

// ─── Transformações ───────────────────────────────────────────────────────────
import { rotate }      from './src/rotate.js';
import { sharpen }     from './src/sharpen.js';
import { adjust }      from './src/adjust.js';
import { vignette }    from './src/vignette.js';
import { perspective } from './src/perspective.js';

// ─── Efeitos Visuais ──────────────────────────────────────────────────────────
import { glitch }   from './src/glitch.js';
import { sketch }   from './src/sketch.js';
import { cartoon }  from './src/cartoon.js';
import { emboss }   from './src/emboss.js';
import { duotone }  from './src/duotone.js';

// ─── Composição ───────────────────────────────────────────────────────────────
import { overlay } from './src/overlay.js';
import { border }  from './src/border.js';
import { shadow }  from './src/shadow.js';

// ─── Forma ────────────────────────────────────────────────────────────────────
import { circle } from './src/circle.js';

// ─── Utilitários ──────────────────────────────────────────────────────────────
import { dominant }                                          from './src/dominant.js';
import { collage }                                           from './src/collage.js';
import { noise }                                             from './src/noise.js';
import { strip, toBase64, fromBase64, getInfo, placeholder } from './src/utils.js';

// ─── Animação ─────────────────────────────────────────────────────────────────
import { gif, speed } from './src/gif.js';
import {
  gifReverse, gifOptimize, gifSpeed, imagesToGif, toAnimatedWebP
} from './src/animation.js';

// ─── Formatos Modernos ────────────────────────────────────────────────────────
import { toAvif } from './src/formats.js';
import { convert } from './src/convert.js';

// ─── Vídeo ────────────────────────────────────────────────────────────────────
import {
  thumbnail, extractFrames, compressVideo,
  videoToGif, watermarkVideo, videoSpeed,
  addSubtitle, videoInfo
} from './src/video.js';

// ─── Hardware Acceleration ────────────────────────────────────────────────────
import { detectHwAccel } from './src/hwaccel.js';

// ─── Text PRO ─────────────────────────────────────────────────────────────────
import { textOverlay, memeGenerator } from './src/text.js';

// ─── Effects PRO ──────────────────────────────────────────────────────────────
import {
  removeBackground, faceCrop, qrOverlay,
  memeFilter, advancedCollage, applyPreset
} from './src/effects-pro.js';

// ─── Progress ─────────────────────────────────────────────────────────────────
import { withProgress, withProgressAll, createProgress } from './src/progress.js';

// ─── Exportação Nomeada ───────────────────────────────────────────────────────
export {
  // Core
  compress, resize, resizeCover, watermark, crop,
  flip, flop, applyFilter, sticker, frame,
  // Transformações
  rotate, sharpen, adjust, vignette, perspective,
  // Efeitos
  glitch, sketch, cartoon, emboss, duotone,
  // Composição
  overlay, border, shadow,
  // Forma
  circle,
  // Utilitários
  dominant, collage, noise, strip, toBase64, fromBase64, getInfo, placeholder,
  // Animação
  gif, speed,
  gifReverse, gifOptimize, gifSpeed, imagesToGif, toAnimatedWebP,
  // Formatos
  toAvif, convert,
  // Vídeo
  thumbnail, extractFrames, compressVideo,
  videoToGif, watermarkVideo, videoSpeed,
  addSubtitle, videoInfo,
  // HW Accel
  detectHwAccel,
  // Text PRO
  textOverlay, memeGenerator,
  // Effects PRO
  removeBackground, faceCrop, qrOverlay,
  memeFilter, advancedCollage, applyPreset,
  // Progress
  withProgress, withProgressAll, createProgress,
};

// ─── Exportação Default ───────────────────────────────────────────────────────
export default {
  // Core
  compress, resize, resizeCover, watermark, crop,
  flip, flop, applyFilter, sticker, frame,
  // Transformações
  rotate, sharpen, adjust, vignette, perspective,
  // Efeitos
  glitch, sketch, cartoon, emboss, duotone,
  // Composição
  overlay, border, shadow,
  // Forma
  circle,
  // Utilitários
  dominant, collage, noise, strip, toBase64, fromBase64, getInfo, placeholder,
  // Animação
  gif, speed,
  gifReverse, gifOptimize, gifSpeed, imagesToGif, toAnimatedWebP,
  // Formatos
  toAvif, convert,
  // Vídeo
  thumbnail, extractFrames, compressVideo,
  videoToGif, watermarkVideo, videoSpeed,
  addSubtitle, videoInfo,
  // HW Accel
  detectHwAccel,
  // Text PRO
  textOverlay, memeGenerator,
  // Effects PRO
  removeBackground, faceCrop, qrOverlay,
  memeFilter, advancedCollage, applyPreset,
  // Progress
  withProgress, withProgressAll, createProgress,
};