import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';
import exifReader from 'exif-reader';

/**
 * MOTOR PRIVADO
 * Gerencia o ciclo de vida do processo FFmpeg e Streams.
 */
function _execFFmpeg(inputStream, command) {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on('data', chunk => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', err => {
      command.kill();
      reject(new Error(`Stream Error: ${err.message}`));
    });

    command
      .on('error', err => {
        command.kill();
        reject(new Error(`FFmpeg Error: ${err.message}`));
      })
      .pipe(outputStream, { end: true });
  });
}

/**
 * FERRAMENTA: Info & Metadados (Turbinada)
 */
export function getImageSpecs(buffer) {
  const dimensions = sizeOf(buffer);
  let metadata = {};
  try {
    metadata = exifReader(buffer);
  } catch (e) {
    metadata = null;
  }
  return { ...dimensions, metadata };
}

/**
 * FERRAMENTA: Redimensionar (Inteligente)
 */
export async function resize(buffer, { width = -1, height = -1, keepRatio = true, upscale = false } = {}) {
  const specs = getImageSpecs(buffer);
  
  // Anti-Upscale: Evita esticar a imagem se ela já for menor que o alvo
  if (!upscale && width > specs.width && height > specs.height) {
    return buffer; 
  }

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream).inputFormat('image2pipe');
  
  const aspect = keepRatio ? ':force_original_aspect_ratio=decrease' : '';
  
  // Adicionamos 'scale' e garantimos compatibilidade de cores com mjpeg
  command.videoFilters(`scale=${width}:${height}${aspect}`).format('mjpeg');
  
  return _execFFmpeg(inputStream, command);
}

/**
 * FERRAMENTA: Converter (Otimizada)
 */
export async function convert(buffer, { format = 'webp', quality = 80 } = {}) {
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream).inputFormat('image2pipe').format(format);
  
  if (format === 'webp') {
    command.outputOptions([`-quality ${quality}`, '-lossless 0']);
  } else {
    const qValue = Math.floor(31 - (quality * 30) / 100);
    command.outputOptions([`-q:v ${Math.max(1, qValue)}`]);
  }

  return _execFFmpeg(inputStream, command);
}

/**
 * FERRAMENTA: Filtros (Pack Completo)
 */
export async function applyFilter(buffer, filterType, options = {}) {
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream).inputFormat('image2pipe').format('mjpeg');

  let filterString = '';
  switch (filterType) {
    case 'grayscale': filterString = 'format=gray'; break;
    case 'sepia':     filterString = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131'; break;
    case 'blur':      filterString = `gblur=sigma=${options.value || 5}`; break;
    case 'vintage':   filterString = 'curves=vintage,noise=alls=10,eq=contrast=1.1'; break;
    case 'edge':      filterString = 'edgedetect=low=0.1:high=0.4'; break;
    case 'negative':  filterString = 'negate'; break;
    case 'mirror':    filterString = options.vertical ? 'vflip' : 'hflip'; break;
    case 'pixelate':
      const p = options.value || 10;
      filterString = `scale=iw/${p}:-1,scale=iw*${p}:-1:flags=neighbor`;
      break;
    default: throw new Error(`Filtro '${filterType}' não suportado.`);
  }

  command.videoFilters(filterString);
  return _execFFmpeg(inputStream, command);
}

