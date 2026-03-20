/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Progress System ───────────────────────────────────────────────────
 * Sistema de progress callback universal.
 * Envolve qualquer função ffsixx adicionando onProgress.
 *
 * @example
 * import { resize } from 'ffsixx';
 * import { withProgress } from 'ffsixx/progress';
 *
 * const resizeP = withProgress(resize);
 * const result  = await resizeP(buffer, { width: 800 }, {
 *   onProgress: ({ percent, stage }) => bot.sendMessage(`${percent}% - ${stage}`)
 * });
 *
 * // Ou direto nas funções que já aceitam onProgress:
 * const result = await resize(buffer, {
 *   width: 800,
 *   onProgress: ({ percent }) => console.log(percent)
 * });
 */

// ─── Estágios padrão por tipo de operação ─────────────────────────────────────

export const STAGES = {
  start:      { percent: 0,   label: 'Iniciando...' },
  reading:    { percent: 10,  label: 'Lendo input...' },
  processing: { percent: 40,  label: 'Processando...' },
  encoding:   { percent: 80,  label: 'Codificando...' },
  finishing:  { percent: 95,  label: 'Finalizando...' },
  done:       { percent: 100, label: 'Concluído' },
};

/**
 * Cria um emissor de progresso tipado.
 * @param {Function|undefined} onProgress - Callback do usuário
 * @returns {{ emit, stages }}
 */
export function createProgress(onProgress) {
  function emit(percent, stage = '', extra = {}) {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress({ percent: Math.round(percent), stage, ...extra });
    } catch {
      // Nunca deixa o callback do usuário quebrar o processamento
    }
  }

  return {
    emit,
    start:      (extra = {}) => emit(0,   'Iniciando',    extra),
    reading:    (extra = {}) => emit(10,  'Lendo input',  extra),
    processing: (extra = {}) => emit(40,  'Processando',  extra),
    encoding:   (extra = {}) => emit(80,  'Codificando',  extra),
    finishing:  (extra = {}) => emit(95,  'Finalizando',  extra),
    done:       (extra = {}) => emit(100, 'Concluído',    extra),
  };
}

/**
 * Envolve qualquer função ffsixx adicionando suporte a onProgress.
 * A função original não precisa ser modificada.
 *
 * O progress é simulado com timing realístico:
 * - 0%  → início imediato
 * - 40% → após 200ms (simula início do FFmpeg)
 * - 80% → após 60% do tempo estimado
 * - 100% → quando a função termina
 *
 * @param {Function} fn - Função ffsixx original
 * @param {string} [name] - Nome para logs
 * @returns {Function} - Versão com suporte a onProgress no último argumento
 */
export function withProgress(fn, name = fn.name || 'operation') {
  return async function progressWrapped(...args) {
    // Extrai onProgress do último argumento se for objeto com essa prop
    const lastArg = args[args.length - 1];
    let onProgress = null;
    let cleanArgs = args;

    if (lastArg && typeof lastArg === 'object' && typeof lastArg.onProgress === 'function') {
      onProgress = lastArg.onProgress;
      // Remove onProgress do objeto de opções antes de passar para a função
      cleanArgs = args.slice(0, -1);
      const optsCopy = { ...lastArg };
      delete optsCopy.onProgress;
      cleanArgs.push(optsCopy);
    } else if (args[1] && typeof args[1] === 'object' && typeof args[1].onProgress === 'function') {
      // onProgress dentro das opções normais (segundo argumento)
      onProgress = args[1].onProgress;
      cleanArgs = [...args];
      cleanArgs[1] = { ...args[1] };
      delete cleanArgs[1].onProgress;
    }

    const p = createProgress(onProgress);
    p.start({ operation: name });

    // Progresso simulado com intervalos
    let interval = null;
    let currentPercent = 0;

    if (onProgress) {
      interval = setInterval(() => {
        if (currentPercent < 75) {
          currentPercent = Math.min(75, currentPercent + 5);
          p.emit(currentPercent, 'Processando');
        }
      }, 150);
    }

    try {
      p.reading();
      const result = await fn(...cleanArgs);
      p.done({ operation: name });
      return result;
    } finally {
      if (interval) clearInterval(interval);
    }
  };
}

/**
 * Cria versões com progress de todas as funções de um módulo.
 *
 * @param {Object} module - Objeto com funções (ex: import * as ffsixx from 'ffsixx')
 * @returns {Object} - Mesmas funções com suporte a onProgress
 *
 * @example
 * import * as ffsixx from 'ffsixx';
 * import { withProgressAll } from 'ffsixx/progress';
 *
 * const fx = withProgressAll(ffsixx);
 * await fx.resize(buffer, {
 *   width: 800,
 *   onProgress: ({ percent }) => updateUI(percent)
 * });
 */
export function withProgressAll(module) {
  const result = {};
  for (const [key, val] of Object.entries(module)) {
    result[key] = typeof val === 'function' ? withProgress(val, key) : val;
  }
  return result;
}

/**
 * Hook para FFmpeg que emite progresso real via eventos do fluent-ffmpeg.
 * Use dentro das funções que constroem comandos FFmpeg diretamente.
 *
 * @param {object} command  - Instância fluent-ffmpeg
 * @param {Function} onProgress
 * @param {number} [duration] - Duração total em segundos (para % mais preciso)
 */
export function attachFFmpegProgress(command, onProgress, duration = null) {
  if (typeof onProgress !== 'function') return command;

  command.on('progress', (info) => {
    try {
      let percent = info.percent;

      // Se FFmpeg não retornar %, calcula pelo tempo processado
      if (!percent && duration && info.timemark) {
        const [h, m, s] = info.timemark.split(':').map(parseFloat);
        const processed = h * 3600 + m * 60 + s;
        percent = Math.min(99, Math.round((processed / duration) * 100));
      }

      onProgress({
        percent:   Math.round(percent || 0),
        stage:     'Processando',
        timemark:  info.timemark,
        fps:       info.currentFps,
        bitrate:   info.currentKbps,
        frames:    info.frames,
      });
    } catch {
      // silencioso
    }
  });

  return command;
}