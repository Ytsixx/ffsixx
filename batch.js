/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx/batch ─────────────────────────────────────────────────────────────
 * Processamento paralelo com limite automático de CPU.
 *
 * @example
 * import { batch, batchPipeline, batchStats, getConcurrency } from 'ffsixx/batch';
 * import { resize, compress, applyFilter } from 'ffsixx';
 *
 * // Processar 100 imagens em paralelo (usa os.cpus().length workers)
 * const results = await batch(images, resize, { width: 800 });
 *
 * // Pipeline: redimensionar → comprimir → filtro
 * const results = await batchPipeline(images, [
 *   [resize,      { width: 1280 }],
 *   [compress,    { maxSizeKB: 200 }],
 *   [applyFilter, 'grayscale'],
 * ]);
 *
 * // Estatísticas do resultado
 * console.log(batchStats(results));
 * // { total: 100, succeeded: 98, failed: 2, successRate: '98.00%', errors: [...] }
 *
 * // Saber quantos workers serão usados
 * console.log(getConcurrency()); // → 8 (em máquina com 8 núcleos)
 */

export { batch, batchPipeline, batchStats, getConcurrency } from './src/batch.js';