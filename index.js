// Importações de todos os módulos
import { compress } from './src/compress.js';
import { resize } from './src/resize.js';
import { resizeCover } from './src/resizeCover.js';
import { watermark } from './src/watermark.js';
import { crop } from './src/crop.js';
import { flip, flop } from './src/mirror.js';
import { applyFilter } from './src/applyFilter.js';

// Exportação unificada
export {
  compress,
  resize,
  resizeCover,
  watermark,
  crop,
  flip,
  flop,
  applyFilter
};

/**
 * SIXX CORE
 * Image Manipulation Toolkit
 * Built with FFmpeg
 * Lightweight • No Native Builds • Stream Friendly
 */