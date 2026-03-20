/**
 * ffsixx - feliz aniversário para mim
 * Moçambique avança com devs
 * by sixx.js [19\/03\/2004]
 */

/**
 * ─── ffsixx Hardware Acceleration ────────────────────────────────────────────
 * Detecta e configura aceleração de hardware disponível no sistema.
 * Suporta: NVENC (NVIDIA), VAAPI (Intel/AMD Linux), VideoToolbox (macOS).
 *
 * Integrado automaticamente em todas as funções de vídeo via hwaccel: 'auto'.
 * Silencioso: se nenhuma GPU for encontrada, cai para CPU sem erro.
 *
 * @example
 * import { compressVideo } from 'ffsixx';
 *
 * // Auto-detect GPU — usa se disponível, CPU se não
 * const result = await compressVideo(buffer, { hwaccel: 'auto' });
 *
 * // Forçar codec específico
 * const result = await compressVideo(buffer, { hwaccel: 'nvenc' });
 *
 * // Desabilitar (sempre CPU)
 * const result = await compressVideo(buffer, { hwaccel: false });
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

// ─── Cache de detecção ────────────────────────────────────────────────────────

let _cachedAccel = undefined; // undefined = não testado ainda

/**
 * Testa se um codec de hardware está disponível no FFmpeg local.
 * @param {string} codec - Ex: 'h264_nvenc', 'h264_vaapi', 'h264_videotoolbox'
 */
async function _testCodec(codec) {
  try {
    await exec('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'nullsrc=s=64x64:d=1',
      '-vcodec', codec,
      '-f', 'null', '-'
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detecta qual aceleração de hardware está disponível.
 * Testa na ordem: nvenc → vaapi → videotoolbox → cpu
 * Resultado é cacheado — só roda uma vez por processo.
 *
 * @returns {Promise<'nvenc'|'vaapi'|'videotoolbox'|'cpu'>}
 */
export async function detectHwAccel() {
  if (_cachedAccel !== undefined) return _cachedAccel;

  // NVIDIA NVENC
  if (await _testCodec('h264_nvenc')) {
    _cachedAccel = 'nvenc';
    return _cachedAccel;
  }

  // Intel/AMD VAAPI (Linux)
  if (await _testCodec('h264_vaapi')) {
    _cachedAccel = 'vaapi';
    return _cachedAccel;
  }

  // Apple VideoToolbox (macOS)
  if (await _testCodec('h264_videotoolbox')) {
    _cachedAccel = 'videotoolbox';
    return _cachedAccel;
  }

  _cachedAccel = 'cpu';
  return _cachedAccel;
}

/**
 * Reseta o cache de detecção.
 * Útil em testes ou quando o ambiente muda.
 */
export function resetHwAccelCache() {
  _cachedAccel = undefined;
}

// ─── Mapeamento de codecs ─────────────────────────────────────────────────────

const CODEC_MAP = {
  nvenc: {
    h264: 'h264_nvenc',
    hevc: 'hevc_nvenc',
    av1:  'av1_nvenc',
    decode_flags: ['-hwaccel', 'cuda'],
    extra_encode: ['-rc', 'vbr', '-cq', '23'],
  },
  vaapi: {
    h264: 'h264_vaapi',
    hevc: 'hevc_vaapi',
    av1:  null, // AV1 VAAPI ainda instável
    decode_flags: ['-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128'],
    extra_encode: ['-vf', 'format=nv12,hwupload'],
  },
  videotoolbox: {
    h264: 'h264_videotoolbox',
    hevc: 'hevc_videotoolbox',
    av1:  null,
    decode_flags: ['-hwaccel', 'videotoolbox'],
    extra_encode: [],
  },
  cpu: {
    h264: 'libx264',
    hevc: 'libx265',
    av1:  'libaom-av1',
    decode_flags: [],
    extra_encode: [],
  },
};

/**
 * Resolve qual backend usar baseado na opção hwaccel fornecida.
 *
 * @param {'auto'|'nvenc'|'vaapi'|'videotoolbox'|false|undefined} option
 * @param {'h264'|'hevc'|'av1'} [codecType='h264']
 * @returns {Promise<{ codec: string, decodeFlags: string[], encodeFlags: string[], backend: string }>}
 */
export async function resolveHwAccel(option = 'auto', codecType = 'h264') {
  // Explicitamente desabilitado
  if (option === false || option === 'cpu') {
    const map = CODEC_MAP.cpu;
    return {
      codec:       map[codecType] || map.h264,
      decodeFlags: [],
      encodeFlags: [],
      backend:     'cpu',
    };
  }

  let backend;
  if (option === 'auto') {
    backend = await detectHwAccel();
  } else if (CODEC_MAP[option]) {
    backend = option;
  } else {
    backend = 'cpu';
  }

  const map = CODEC_MAP[backend];

  // Fallback se o codec do tipo não existir nesse backend
  const codec = map[codecType] || CODEC_MAP.cpu[codecType] || CODEC_MAP.cpu.h264;
  const actualBackend = map[codecType] ? backend : 'cpu';

  return {
    codec,
    decodeFlags: actualBackend !== 'cpu' ? map.decode_flags : [],
    encodeFlags: actualBackend !== 'cpu' ? map.extra_encode : [],
    backend:     actualBackend,
  };
}

/**
 * Aplica as flags de hardware acceleration em um comando fluent-ffmpeg.
 * @param {object} command - Instância fluent-ffmpeg
 * @param {object} hwInfo  - Resultado de resolveHwAccel()
 */
export function applyHwAccelToCommand(command, hwInfo) {
  if (hwInfo.decodeFlags.length > 0) {
    command.inputOptions(hwInfo.decodeFlags);
  }
  return command;
}