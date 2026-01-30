import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';

function _execFFmpeg(inputStream, command) {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];
    outputStream.on('data', chunk => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', err => { command.kill(); reject(err); });
    command.on('error', err => { command.kill(); reject(err); }).pipe(outputStream, { end: true });
  });
}

export async function compress(buffer, { 
  maxSizeKB = 300, 
  quality = 90, 
  mode = 'balanced', 
  format = 'jpeg' // 🔧 Ajuste 2: Nome intuitivo para o usuário
} = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  let currentBuffer = buffer;
  let currentQuality = quality;
  let scalePercent = 100;
  let iterations = 0; // 🔧 Ajuste 1: Contador real iniciado em 0
  
  const targetSize = maxSizeKB * 1024;
  const specs = sizeOf(buffer); // 🔧 Ajuste 3: Pegando dimensões originais

  if (buffer.length <= targetSize) {
    return { buffer, sizeKB: Math.round(buffer.length / 1024), iterations: 0, success: true };
  }

  const maxTries = mode === 'fast' ? 3 : mode === 'balanced' ? 6 : 10;
  const ffmpegFormat = format === 'jpeg' ? 'mjpeg' : format; // Mapeamento interno

  for (let i = 0; i < maxTries; i++) {
    iterations++; // Incrementa no início de cada tentativa real
    
    // 🔧 Ajuste 3: Proteção de escala mínima (não deixa a largura ficar menor que 320px)
    if (mode !== 'fast' && (specs.width * (scalePercent / 100) < 320)) {
      console.log('🛑 Freio de escala: atingido tamanho mínimo legível.');
      break; 
    }

    const inputStream = Readable.from(currentBuffer);
    const command = ffmpeg(inputStream).inputFormat('image2pipe').format(ffmpegFormat);

    const qValue = Math.floor(31 - (currentQuality * 30) / 100);
    
    if (mode !== 'fast') {
      command.videoFilters(`scale=iw*${scalePercent / 100}:-1`);
    }

    command.outputOptions([`-q:v ${Math.max(1, qValue)}`]);

    currentBuffer = await _execFFmpeg(inputStream, command);

    if (currentBuffer.length <= targetSize) break;

    // Lógica de redução para próxima iteração
    currentQuality -= (mode === 'precise' ? 8 : 15);
    if (mode !== 'fast') scalePercent -= 8;

    if (currentQuality < 5) break;
  }

  return {
    buffer: currentBuffer,
    sizeKB: Math.round(currentBuffer.length / 1024),
    quality: currentQuality,
    iterations: iterations,
    success: currentBuffer.length <= targetSize
  };
}
