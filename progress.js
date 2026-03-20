/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx/progress ──────────────────────────────────────────────────────────
 * Sistema de progress callback para todas as funções ffsixx.
 *
 * @example
 * // Opção 1: onProgress direto nas opções
 * import { resize } from 'ffsixx';
 * const result = await resize(buffer, {
 *   width: 800,
 *   onProgress: ({ percent, stage }) => console.log(`${percent}% - ${stage}`)
 * });
 *
 * @example
 * // Opção 2: withProgress wrapper
 * import { withProgress } from 'ffsixx/progress';
 * import { compress } from 'ffsixx';
 *
 * const compressP = withProgress(compress);
 * const result = await compressP(buffer, { maxSizeKB: 200 }, {
 *   onProgress: ({ percent }) => updateProgressBar(percent)
 * });
 *
 * @example
 * // Opção 3: withProgressAll — todas as funções com progress
 * import * as ffsixx from 'ffsixx';
 * import { withProgressAll } from 'ffsixx/progress';
 *
 * const fx = withProgressAll(ffsixx);
 * await fx.compressVideo(buffer, {
 *   crf: 28,
 *   onProgress: ({ percent, fps, bitrate }) =>
 *     bot.editMessage(`🔄 ${percent}% | ${fps}fps | ${bitrate}kbps`)
 * });
 */

export {
  withProgress,
  withProgressAll,
  createProgress,
  attachFFmpegProgress,
  STAGES,
} from './src/progress.js';