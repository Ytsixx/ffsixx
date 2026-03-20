/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Batch Processor ───────────────────────────────────────────────────
 * Processa múltiplas imagens em paralelo com limite automático de CPU.
 * Usa os.cpus().length para detectar núcleos disponíveis.
 *
 * @example
 * import { batch } from 'ffsixx/batch';
 * import { resize, compress } from 'ffsixx';
 *
 * const images = [buf1, buf2, buf3, ...]; // até centenas
 *
 * // Básico — usa todos os núcleos disponíveis
 * const results = await batch(images, resize, { width: 800, fit: 'cover' });
 *
 * // Com progresso
 * const results = await batch(images, compress, { maxSizeKB: 200 }, {
 *   onProgress: ({ done, total, percent }) =>
 *     console.log(`${done}/${total} (${percent}%)`),
 * });
 *
 * // Pipeline: redimensionar E comprimir
 * const results = await batchPipeline(images, [
 *   [resize,   { width: 1280 }],
 *   [compress, { maxSizeKB: 300 }],
 * ]);
 */

import { cpus } from 'os';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detecta o número de núcleos lógicos disponíveis.
 * Limita a 16 para não sobrecarregar em máquinas grandes.
 */
function _getWorkerCount() {
  return Math.min(cpus().length || 4, 16);
}

/**
 * Pool de concorrência genérico.
 * Processa `tasks` com no máximo `concurrency` simultâneos.
 *
 * @param {Array}    tasks       - Array de funções async () => result
 * @param {number}   concurrency - Máximo de tarefas simultâneas
 * @param {Function} [onDone]    - Callback após cada tarefa concluída
 * @returns {Promise<Array<{status, value, reason, index}>>}
 */
async function _pool(tasks, concurrency, onDone) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  let doneCount = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i](), index: i };
      } catch (err) {
        results[i] = { status: 'rejected', reason: err, index: i };
      }
      doneCount++;
      onDone?.(doneCount, tasks.length, i, results[i]);
    }
  }

  // Dispara `concurrency` workers em paralelo
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ─── batch ────────────────────────────────────────────────────────────────────

/**
 * Processa um array de imagens com uma função ffsixx em paralelo.
 *
 * @param {Buffer[]|import('stream').Readable[]} inputs
 *   Array de Buffers ou Streams de imagem.
 *
 * @param {Function} fn
 *   Qualquer função ffsixx: resize, compress, sticker, applyFilter, etc.
 *
 * @param {Object} [fnOptions={}]
 *   Opções repassadas para cada chamada da função.
 *
 * @param {Object} [batchOptions={}]
 * @param {number}   [batchOptions.concurrency]
 *   Máximo de tarefas simultâneas. Padrão: os.cpus().length (máx. 16).
 * @param {boolean}  [batchOptions.stopOnError=false]
 *   Se true, lança erro na primeira falha. Se false, continua e reporta erros por item.
 * @param {Function} [batchOptions.onProgress]
 *   Callback chamado após cada imagem processada.
 *   Recebe: { done, total, percent, index, success, error? }
 * @param {Function} [batchOptions.onError]
 *   Callback para erros individuais. Recebe: { index, error, input }
 *
 * @returns {Promise<BatchResult[]>}
 *   Array preservando a ordem do input. Cada item tem:
 *   - { ok: true,  value: resultado, index }  — sucesso
 *   - { ok: false, error: Error,     index }  — falha individual
 *
 * @example
 * const results = await batch(images, resize, { width: 400 }, {
 *   onProgress: ({ percent }) => console.log(`${percent}%`)
 * });
 *
 * // Filtrar só os que tiveram sucesso
 * const buffers = results.filter(r => r.ok).map(r => r.value.buffer);
 */
export async function batch(inputs, fn, fnOptions = {}, batchOptions = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('[ffsixx/batch] inputs deve ser um array não vazio.');
  }
  if (typeof fn !== 'function') {
    throw new Error('[ffsixx/batch] fn deve ser uma função ffsixx.');
  }

  const {
    concurrency  = _getWorkerCount(),
    stopOnError  = false,
    onProgress   = null,
    onError      = null,
  } = batchOptions;

  const total = inputs.length;

  // Se stopOnError, usamos uma flag de abort
  let aborted = false;

  const tasks = inputs.map((input, i) => async () => {
    if (aborted) throw new Error('Batch abortado por erro anterior.');
    return fn(input, fnOptions);
  });

  const rawResults = await _pool(
    tasks,
    Math.max(1, concurrency),
    (done, total, i, result) => {
      const success = result?.status === 'fulfilled';
      const error   = result?.status === 'rejected' ? result.reason : undefined;

      if (!success && stopOnError) aborted = true;
      if (!success && onError) onError({ index: i, error, input: inputs[i] });

      onProgress?.({
        done,
        total,
        percent: Math.round((done / total) * 100),
        index: i,
        success,
        error,
      });
    }
  );

  // Normaliza para formato limpo
  return rawResults.map(r => r.status === 'fulfilled'
    ? { ok: true,  value: r.value, index: r.index }
    : { ok: false, error: r.reason, index: r.index }
  );
}

// ─── batchPipeline ────────────────────────────────────────────────────────────

/**
 * Aplica uma sequência de funções em cada imagem do array.
 * Cada etapa recebe o buffer resultado da anterior.
 *
 * @param {Buffer[]} inputs - Array de Buffers de entrada
 * @param {Array<[Function, Object?]>} pipeline
 *   Array de pares [função, opções]. Ex: [[resize, {width:800}], [compress, {maxSizeKB:200}]]
 * @param {Object} [batchOptions] - Mesmas opções do batch()
 *
 * @returns {Promise<BatchResult[]>}
 *
 * @example
 * const results = await batchPipeline(images, [
 *   [resize,      { width: 1280, fit: 'cover' }],
 *   [compress,    { maxSizeKB: 300 }],
 *   [applyFilter, 'grayscale'],
 * ]);
 */
export async function batchPipeline(inputs, pipeline, batchOptions = {}) {
  if (!Array.isArray(pipeline) || pipeline.length === 0) {
    throw new Error('[ffsixx/batch] pipeline deve ser um array de [fn, options].');
  }

  // Cria uma função composta que aplica cada etapa em sequência
  async function runPipeline(input) {
    let current = input;

    for (const step of pipeline) {
      const [fn, options] = Array.isArray(step) ? step : [step, {}];

      if (typeof fn !== 'function') {
        throw new Error(`[ffsixx/batch] Etapa inválida no pipeline: ${fn}`);
      }

      const result = await fn(current, options);

      // Extrai o buffer do resultado (pode ser { buffer, ... } ou Buffer direto)
      current = Buffer.isBuffer(result) ? result : result.buffer;

      if (!Buffer.isBuffer(current)) {
        throw new Error(`[ffsixx/batch] Etapa do pipeline não retornou um Buffer válido.`);
      }
    }

    return current;
  }

  return batch(inputs, runPipeline, {}, batchOptions);
}

// ─── batchStats ───────────────────────────────────────────────────────────────

/**
 * Analisa os resultados de um batch e retorna estatísticas.
 *
 * @param {BatchResult[]} results - Resultado de batch() ou batchPipeline()
 * @returns {BatchStats}
 *
 * @example
 * const results = await batch(images, compress, { maxSizeKB: 200 });
 * const stats = batchStats(results);
 * console.log(stats);
 * // {
 * //   total: 100, succeeded: 98, failed: 2,
 * //   successRate: '98.00%',
 * //   errors: [{ index: 3, message: '...' }, ...]
 * // }
 */
export function batchStats(results) {
  const succeeded = results.filter(r => r.ok).length;
  const failed    = results.filter(r => !r.ok).length;

  return {
    total:       results.length,
    succeeded,
    failed,
    successRate: `${((succeeded / results.length) * 100).toFixed(2)}%`,
    concurrency: _getWorkerCount(),
    errors: results
      .filter(r => !r.ok)
      .map(r => ({ index: r.index, message: r.error?.message ?? String(r.error) })),
  };
}

// ─── getConcurrency ───────────────────────────────────────────────────────────

/**
 * Retorna o número de workers que batch() usará por padrão.
 * Útil para exibir ao usuário ou ajustar manualmente.
 *
 * @returns {number}
 */
export function getConcurrency() {
  return _getWorkerCount();
}