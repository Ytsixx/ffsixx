/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Engine ────────────────────────────────────────────────────────────
 * Motor central da lib.
 * Detecta automaticamente se o FFmpeg nativo está disponível.
 * Se não estiver, cai silenciosamente para @ffmpeg/ffmpeg (WASM).
 *
 * Uso interno — não faça import direto deste módulo.
 * Use createFFsixx() via 'ffsixx/wasm' para controle explícito.
 */

import { PassThrough } from 'stream';

// ─── Detecção de ambiente ─────────────────────────────────────────────────────

export const isBrowser = typeof window !== 'undefined';
export const isNode    = typeof process !== 'undefined' && process.versions?.node;

/**
 * Testa se o FFmpeg nativo está acessível no PATH.
 * Retorna false em browsers ou ambientes sem processo filho.
 */
async function _detectNativeFFmpeg() {
  if (isBrowser) return false;
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execFile);
    await exec('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

// Cache do resultado de detecção (só roda uma vez)
let _nativeAvailable = null;
export async function hasNativeFFmpeg() {
  if (_nativeAvailable === null) {
    _nativeAvailable = await _detectNativeFFmpeg();
  }
  return _nativeAvailable;
}

// ─── Motor Nativo (fluent-ffmpeg) ─────────────────────────────────────────────

/**
 * Executa um comando fluent-ffmpeg via Streams.
 * Usado internamente por todas as funções quando nativo está disponível.
 */
export function execNative(inputStream, command) {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];
    outputStream.on('data', chunk => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', err => { command.kill(); reject(err); });
    command
      .on('error', err => { command.kill(); reject(err); })
      .pipe(outputStream, { end: true });
  });
}

/**
 * Executa um comando fluent-ffmpeg sem input stream (ex: collage, gif).
 * Usado quando o comando já tem múltiplos inputs via arquivos temporários.
 */
export function execNativeCmd(command) {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];
    outputStream.on('data', chunk => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', err => { command.kill(); reject(err); });
    command
      .on('error', err => { command.kill(); reject(err); })
      .pipe(outputStream, { end: true });
  });
}

// ─── Motor WASM (@ffmpeg/ffmpeg) ──────────────────────────────────────────────

let _wasmInstance = null;

/**
 * Inicializa (ou reutiliza) a instância WASM do FFmpeg.
 * Lazy-loaded: só carrega quando realmente necessário.
 */
export async function getWasmFFmpeg() {
  if (_wasmInstance) return _wasmInstance;

  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();

    // Em browser: carrega via CDN com SharedArrayBuffer (requer COOP/COEP headers)
    // Em Node/Edge: carrega do pacote local
    if (isBrowser) {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
    } else {
      // Node.js / Deno / Bun / Edge runtimes — usa assets do pacote
      await ffmpeg.load();
    }

    _wasmInstance = { ffmpeg, fetchFile };
    return _wasmInstance;

  } catch (err) {
    throw new Error(
      `[ffsixx] Falha ao carregar @ffmpeg/ffmpeg (WASM).\n` +
      `Instale com: npm install @ffmpeg/ffmpeg @ffmpeg/util\n` +
      `Erro original: ${err.message}`
    );
  }
}

/**
 * Executa filtros FFmpeg via WASM.
 * Recebe um buffer de entrada e a lista de argumentos FFmpeg (sem -i / output).
 *
 * @param {Buffer}   inputBuffer   - Imagem de entrada
 * @param {string[]} ffmpegArgs    - Args FFmpeg (ex: ['-vf', 'scale=300:-1', '-f', 'mjpeg'])
 * @param {string}   [inputExt]   - Extensão do input. Padrão: 'jpg'
 * @param {string}   [outputExt]  - Extensão do output. Padrão: 'jpg'
 * @returns {Promise<Buffer>}
 */
export async function execWasm(inputBuffer, ffmpegArgs, inputExt = 'jpg', outputExt = 'jpg') {
  const { ffmpeg, fetchFile } = await getWasmFFmpeg();

  const inputName  = `input.${inputExt}`;
  const outputName = `output.${outputExt}`;

  // Escreve o input no sistema de arquivos virtual do WASM
  await ffmpeg.writeFile(inputName, await fetchFile(new Blob([inputBuffer])));

  // Executa: ffmpeg -i input.jpg <args> output.jpg
  await ffmpeg.exec(['-i', inputName, ...ffmpegArgs, outputName]);

  // Lê o resultado
  const data = await ffmpeg.readFile(outputName);
  const result = Buffer.from(data);

  // Limpa o FS virtual
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return result;
}

/**
 * Executa múltiplos inputs via WASM (usado em collage, overlay, gif).
 *
 * @param {Array<{name: string, buffer: Buffer}>} inputs
 * @param {string[]} ffmpegArgs
 * @param {string}   outputName
 * @returns {Promise<Buffer>}
 */
export async function execWasmMulti(inputs, ffmpegArgs, outputName = 'output.jpg') {
  const { ffmpeg, fetchFile } = await getWasmFFmpeg();

  // Escreve todos os inputs no FS virtual
  for (const { name, buffer } of inputs) {
    await ffmpeg.writeFile(name, await fetchFile(new Blob([buffer])));
  }

  // Monta os args com múltiplos -i
  const inputArgs = inputs.flatMap(({ name }) => ['-i', name]);
  await ffmpeg.exec([...inputArgs, ...ffmpegArgs, outputName]);

  const data = await ffmpeg.readFile(outputName);
  const result = Buffer.from(data);

  // Limpa
  for (const { name } of inputs) {
    await ffmpeg.deleteFile(name).catch(() => {});
  }
  await ffmpeg.deleteFile(outputName).catch(() => {});

  return result;
}

// ─── Exportação de conveniência ───────────────────────────────────────────────

/**
 * Retorna o modo atual do engine após detecção.
 * Útil para debug: console.log(await getEngineMode()) → 'native' | 'wasm'
 */
export async function getEngineMode() {
  return (await hasNativeFFmpeg()) ? 'native' : 'wasm';
}