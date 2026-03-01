// 1. Importações Únicas
import { compress } from './src/compress.js';
import { resize } from './src/resize.js';
import resizeCover from './src/resizeCover.js';
import { watermark } from './src/watermark.js';
import { crop } from './src/crop.js';
import { flip, flop } from './src/mirror.js';
import { applyFilter } from './src/applyFilter.js';
import { sticker } from './src/sticker.js';
import { frame } from './src/frame.js';
import { rotate } from './src/rotate.js';
import { sharpen } from './src/sharpen.js';
import { adjust } from './src/adjust.js';

// 2. Exportação Nomeada (Sem Duplicatas)
export {
  compress,
  resize,
  resizeCover,
  watermark,
  crop,
  flip,
  flop,
  applyFilter,
  sticker,
  frame,
  rotate,
  sharpen,
  adjust
};

// 3. Exportação Default
export default {
  compress,
  resize,
  resizeCover,
  watermark,
  crop,
  flip,
  flop,
  applyFilter,
  sticker,
  frame,
  rotate,
  sharpen,
  adjust
};
