import { strict as assert } from 'node:assert';
import { readFile } from 'fs/promises';
import { resize } from '../index.js';

describe('resize()', function() {
  // 🕒 1. Aumenta o timeout para 10 segundos (Essencial no Termux/Android)
  this.timeout(10000);

  it('deve redimensionar imagem em modo cover para 500x500', async () => {
    const buffer = await readFile('./database/imagem/t.jpeg');

    const resultado = await resize(buffer, { 
      width: 500,
      height: 500,
      fit: 'cover'
    });

    // ✅ 2. Acessa resultado.buffer em vez do objeto direto
    assert.ok(Buffer.isBuffer(resultado.buffer), 'Resultado não contém um Buffer');
    assert.ok(resultado.buffer.length > 0, 'Buffer está vazio');
    
    // Teste extra opcional para garantir que o objeto veio certo
    assert.strictEqual(resultado.width, 500, 'Largura retornada está incorreta');
  });

  it('deve redimensionar imagem em modo contain com fundo', async () => {
    const buffer = await readFile('./database/imagem/t.jpeg');

    const resultado = await resize(buffer, {
      width: 1920,
      height: 1080,
      fit: 'contain',
      background: '#1a1a1a'
    });

    // ✅ 3. Mesma correção: extraindo o buffer do objeto de resposta
    assert.ok(Buffer.isBuffer(resultado.buffer), 'Resultado não contém um Buffer');
    assert.ok(resultado.buffer.length > 0, 'Buffer está vazio');
  });
});
