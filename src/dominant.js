import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';

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

/**
 * Converte RGB para HEX
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Quantização simples por K-Means em pixels amostrados
 */
function kMeans(pixels, k = 5, iterations = 10) {
  // Inicializa centróides com pixels aleatórios
  let centroids = pixels
    .filter((_, i) => i % Math.floor(pixels.length / k) === 0)
    .slice(0, k);

  for (let iter = 0; iter < iterations; iter++) {
    // Agrupa pixels pelo centróide mais próximo
    const clusters = Array.from({ length: k }, () => []);

    for (const px of pixels) {
      let minDist = Infinity;
      let closest = 0;
      for (let i = 0; i < centroids.length; i++) {
        const c = centroids[i];
        const dist = Math.sqrt(
          (px[0] - c[0]) ** 2 +
          (px[1] - c[1]) ** 2 +
          (px[2] - c[2]) ** 2
        );
        if (dist < minDist) { minDist = dist; closest = i; }
      }
      clusters[closest].push(px);
    }

    // Recalcula centróides como média do cluster
    centroids = clusters.map(cluster => {
      if (cluster.length === 0) return [0, 0, 0];
      const avg = cluster.reduce((acc, px) => [acc[0] + px[0], acc[1] + px[1], acc[2] + px[2]], [0, 0, 0]);
      return avg.map(v => Math.round(v / cluster.length));
    });
  }

  return centroids;
}

/**
 * FERRAMENTA: Dominant Colors (Cores Dominantes)
 * Extrai as N cores mais presentes na imagem usando K-Means.
 *
 * @param {Buffer} buffer - Buffer da imagem original
 * @param {Object} options
 * @param {number} options.count     - Quantidade de cores a extrair. Padrão: 5
 * @param {number} options.quality   - Qualidade da amostragem (1=máximo, 10=rápido). Padrão: 5
 */
export async function dominant(buffer, { count = 5, quality = 5 } = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('O input deve ser um Buffer válido.');
  }

  // 1. Reduz a imagem para uma miniatura para acelerar a análise
  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream)
    .inputFormat('image2pipe')
    .videoFilters('scale=100:100:force_original_aspect_ratio=decrease')
    .format('rawvideo')
    .outputOptions(['-pix_fmt rgb24']);

  const rawBuffer = await _execFFmpeg(inputStream, command);

  // 2. Lê os pixels do raw RGB (3 bytes por pixel: R, G, B)
  const pixels = [];
  const step = quality; // Pula pixels para acelerar
  for (let i = 0; i < rawBuffer.length - 2; i += 3 * step) {
    const r = rawBuffer[i];
    const g = rawBuffer[i + 1];
    const b = rawBuffer[i + 2];
    // Ignora pixels muito escuros ou muito claros (bordas/fundos)
    const brightness = (r + g + b) / 3;
    if (brightness > 10 && brightness < 245) {
      pixels.push([r, g, b]);
    }
  }

  if (pixels.length < count) {
    throw new Error('Imagem sem pixels suficientes para análise.');
  }

  // 3. Executa K-Means para encontrar os centróides (cores dominantes)
  const safeCount = Math.min(count, 10);
  const centroids = kMeans(pixels, safeCount);

  // 4. Monta o resultado com HEX, RGB e luminosidade
  const colors = centroids.map(([r, g, b]) => {
    const hex = rgbToHex(r, g, b);
    const luminance = Math.round((0.299 * r + 0.587 * g + 0.114 * b));
    return {
      hex,
      rgb: { r, g, b },
      luminance,
      isDark: luminance < 128
    };
  });

  // Ordena por luminância (mais escura primeiro)
  colors.sort((a, b) => a.luminance - b.luminance);

  return {
    colors,
    count: colors.length,
    palette: colors.map(c => c.hex), // Atalho: array simples de HEX
    type: 'dominant'
  };
}
