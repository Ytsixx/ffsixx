import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { resolve } from 'path';
import { existsSync } from 'fs'; // Para validação da fonte

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
 * FERRAMENTA: Watermark com Blindagem e Fonte Local
 */
export async function watermark(buffer, options = {}) {
  // 🔧 1. Validação mínima de entrada
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Input deve ser um Buffer válido');
  }

  const {
    text = '',
    logo = null,
    position = 'bottom-right',
    opacity = 0.5,
    fontSize = 40,
    color = 'white'
  } = options;

  // 🔧 2. Fallback e Validação da fonte
  const fontPath = resolve('./database/fontes/SNPro-Bold.ttf');
  if (text && !existsSync(fontPath)) {
    throw new Error(`Fonte não encontrada no caminho: ${fontPath}`);
  }

  // 🔧 3. Opacity seguro (Garante intervalo entre 0 e 1)
  const safeOpacity = Math.max(0, Math.min(opacity, 1));

  const inputStream = Readable.from(buffer);
  const command = ffmpeg(inputStream).inputFormat('image2pipe').format('mjpeg');

  if (logo && Buffer.isBuffer(logo)) {
    const logoStream = Readable.from(logo);
    command.input(logoStream).inputFormat('image2pipe');
    
    const posMap = {
      'top-left': '10:10',
      'top-right': 'main_w-overlay_w-10:10',
      'bottom-left': '10:main_h-overlay_h-10',
      'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
      'center': '(main_w-overlay_w)/2:(main_h-overlay_h)/2'
    };

    command.complexFilter([
      { filter: 'format', options: 'rgba', inputs: '1:v', outputs: 'logo' },
      { filter: 'colorchannelmixer', options: { aa: safeOpacity }, inputs: 'logo', outputs: 'alpha_logo' },
      { 
        filter: 'overlay', 
        options: { x: posMap[position].split(':')[0], y: posMap[position].split(':')[1] },
        inputs: ['0:v', 'alpha_logo']
      }
    ]);
  } else if (text) {
    const xPos = position.includes('right') ? 'w-tw-30' : position.includes('left') ? '30' : '(w-tw)/2';
    const yPos = position.includes('bottom') ? 'h-th-30' : position.includes('top') ? '30' : '(h-th)/2';

    command.videoFilters([
      {
        filter: 'drawtext',
        options: {
          text: text,
          fontfile: fontPath,
          fontsize: fontSize,
          fontcolor: `${color}@${safeOpacity}`, // 🔧 Usando opacity seguro
          x: xPos,
          y: yPos,
          shadowcolor: 'black@0.4',
          shadowx: 2,
          shadowy: 2
        }
      }
    ]);
  }

  // 🔧 4. Retorno enriquecido
  return {
    buffer: await _execFFmpeg(inputStream, command),
    type: 'watermark',
    mode: text ? 'text' : (logo ? 'logo' : 'none'),
    appliedAt: new Date().toISOString()
  };
}
