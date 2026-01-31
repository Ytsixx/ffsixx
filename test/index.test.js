import { strict as assert } from 'node:assert';
import { readFile } from 'fs/promises';
// Importando as ferramentas corretas (frame no lugar de circle)
import FFSIXX, { flip, flop, compress, sticker, frame } from '../index.js';

describe('🚀 FFSIXX - Mega Teste de Integração', function() {
  this.timeout(15000);
  let img;

  before(async () => {
    img = await readFile('./database/imagem/t.jpeg');
  });

  it('deve validar o Export Default (API completa)', () => {
    assert.ok(FFSIXX.resize, 'Método resize faltando');
    assert.ok(FFSIXX.frame, 'Método frame faltando');
    assert.ok(FFSIXX.sticker, 'Método sticker faltando');
    assert.ok(FFSIXX.compress, 'Método compress faltando');
  });

  it('deve realizar Mirroring (Flip/Flop)', async () => {
    const fH = await flip(img);
    const fV = await FFSIXX.flop(img);
    assert.ok(Buffer.isBuffer(fH.buffer));
    assert.strictEqual(fH.mode, 'horizontal');
    assert.strictEqual(fV.mode, 'vertical');
  });

  it('deve comprimir imagem para menos de 300KB', async () => {
    const resultado = await compress(img, { maxSizeKB: 300 });
    assert.ok(resultado.sizeKB <= 300);
    assert.strictEqual(resultado.type, 'compressed');
  });

  it('deve gerar um Sticker (WebP) compatível com WhatsApp', async () => {
    const res = await sticker(img, { quality: 70 });
    assert.strictEqual(res.format, 'webp', 'Deveria ser formato webp');
    assert.ok(res.buffer.length > 0);
    assert.strictEqual(res.type, 'sticker');
  });
  
  it('deve rodar o resizeCover com objeto de opções', async () => {
    const res = await FFSIXX.resizeCover(img, { width: 400, height: 400 });
    assert.ok(Buffer.isBuffer(res.buffer));
    assert.strictEqual(res.width, 400);
  });
  
  it('deve aplicar uma moldura (frame) com sucesso', async () => {
    const res = await FFSIXX.frame(img, { color: 'white', thickness: 15 });
    assert.ok(Buffer.isBuffer(res.buffer));
    assert.strictEqual(res.type, 'framed');
    assert.ok(res.buffer.length > 0);
  });
}); // <--- O erro provavelmente estava aqui, faltando fechar o describe
