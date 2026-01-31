import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import sizeOf from 'image-size';

/**
 * MOTOR INTERNO: Executa o comando FFmpeg via Streams
 */
function _execFFmpeg(inputStream, command) {
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
 * FERRAMENTA: Compressão Inteligente
 * Reduz o peso da imagem iterativamente até atingir o alvo em KB.
 */
export async function compress(buffer, options = {}) {
  // 1. Configurações Iniciais
  const { 
    maxSizeKB = 300, 
    quality = 90, 
    mode = 'balanced', 
    format = 'jpeg' 
  } = options;

  if (!Buffer.isBuffer(buffer)) throw new Error('Input inválido');

  const targetSize = maxSizeKB * 1024;
  const specs = sizeOf(buffer);
  
  let currentBuffer = buffer;
  let currentQuality = quality;
  let scalePercent = 100;
  let iterations = 0;

  // 2. Atalho: Se já estiver leve, não processa
  if (buffer.length <= targetSize) {
    return { 
      buffer, 
      sizeKB: Math.round(buffer.length / 1024), 
      iterations: 0, 
      success: true,
      type: 'compressed' // ✅ Mantém a compatibilidade com o teste
    };
  }

  // 3. Configuração do Loop de Otimização
  const maxTries = mode === 'fast' ? 3 : mode === 'balanced' ? 6 : 10;
  const ffmpegFormat = format === 'jpeg' ? 'mjpeg' : format;

  for (let i = 0; i < maxTries; i++) {
    iterations++;

    // Proteção de qualidade visual (Freio de escala)
    if (mode !== 'fast' && (specs.width * (scalePercent / 100) < 320)) break;

    const inputStream = Readable.from(currentBuffer);
    const command = ffmpeg(inputStream)
      .inputFormat('image2pipe')
      .format(ffmpegFormat);

    // Mapeamento de qualidade (1-31 no FFmpeg, onde 1 é melhor)
    const qValue = Math.floor(31 - (currentQuality * 30) / 100);
    
    if (mode !== 'fast') {
      command.videoFilters(`scale=iw*${scalePercent / 100}:-1`);
    }

    command.outputOptions([`-q:v ${Math.max(1, qValue)}`]);

    // Executa e atualiza o buffer atual
    currentBuffer = await _execFFmpeg(inputStream, command);

    // Checa se atingiu o objetivo
    if (currentBuffer.length <= targetSize) break;

    // Ajusta parâmetros para a próxima tentativa
    currentQuality -= (mode === 'precise' ? 8 : 15);
    if (mode !== 'fast') scalePercent -= 8;

    if (currentQuality < 5) break;
  }

  // 4. Retorno Padronizado (Rico em Metadados)
  return {
    buffer: currentBuffer,
    sizeKB: Math.round(currentBuffer.length / 1024),
    quality: currentQuality,
    iterations: iterations,
    success: currentBuffer.length <= targetSize,
    type: 'compressed' // ✅ Corrigido: Agora o teste vai ler este campo
  };
}
