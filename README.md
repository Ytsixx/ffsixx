🚀 FFSIXX

FFSIXX é uma biblioteca ultra-leve e poderosa para manipulação de imagens no Node.js, construída sobre o motor do FFmpeg.

Diferente de outras libs, a FFSIXX trabalha inteiramente com Buffers e Streams, sendo perfeita para Bots (WhatsApp/Telegram), ferramentas de CLI e ambientes com recursos limitados como o Termux.

https://img.shields.io/npm/v/ffsixx.svg
https://img.shields.io/npm/l/ffsixx.svg
https://img.shields.io/npm/dm/ffsixx.svg

---

✨ Destaques

· Zero dependências pesadas: Usa o FFmpeg que você já tem no sistema
· Compressão Inteligente: Define um alvo (ex: 200KB) e a lib ajusta qualidade/escala automaticamente
· Branding Ready: Marca d'água com texto ou logo com controle total de opacidade
· Smart Resize: Modos cover (corte inteligente) e contain (com fundo customizável)
· Stream Friendly: Sem arquivos temporários, tudo processado em memória
· TypeScript Ready: Tipagem completa incluída

---

📦 Instalação

Pré-requisitos

Certifique-se de ter o FFmpeg instalado:

Ubuntu/Debian

```bash
sudo apt install ffmpeg
```

macOS

```bash
brew install ffmpeg
```

Termux (Android)

```bash
pkg install ffmpeg
```

Instalação do pacote

```bash
npm install ffsixx
```

---

🛠️ Como Usar

1. Compressão Inteligente (Target Size)

Ideal para bots que precisam enviar imagens leves sem perder qualidade visual.

```javascript
import { compress } from 'ffsixx';
import { readFile, writeFile } from 'fs/promises';

const buffer = await readFile('foto_pesada.jpg');
const { buffer: result, sizeKB } = await compress(buffer, { 
  maxSizeKB: 300, 
  mode: 'balanced' 
});

await writeFile('foto_leve.jpg', result);
console.log(`✅ Comprimido para ${sizeKB}KB`);
```

2. Marca d'água (Branding)

```javascript
import { watermark } from 'ffsixx';

// Com texto
const resultado = await watermark(buffer, {
  text: 'SIXX CORE',
  position: 'bottom-right',
  opacity: 0.7,
  fontSize: 45,
  color: 'white'
});

// Com logo
const comLogo = await watermark(buffer, {
  logo: await readFile('logo.png'),
  position: 'top-left',
  opacity: 0.5
});

await writeFile('branded.jpg', resultado.buffer);
```

3. Resize Inteligente (Cover/Contain)

```javascript
import { resize } from 'ffsixx';

// Modo Cover: Corta o excesso para preencher exatamente 500x500
const thumb = await resize(buffer, { 
  width: 500, 
  height: 500, 
  fit: 'cover' 
});

// Modo Contain: Mantém proporções com fundo customizado
const card = await resize(buffer, {
  width: 1920,
  height: 1080,
  fit: 'contain',
  background: '#1a1a1a'
});
```

4. Crop (Recorte)

```javascript
import { crop } from 'ffsixx';

const recorte = await crop(buffer, {
  x: 100,
  y: 50,
  width: 400,
  height: 300
});
```

---

🔧 API Reference

Funções Principais

Função Parâmetros Principais Descrição
compress maxSizeKB, mode, format Comprime até atingir o tamanho alvo
watermark text, logo, position, opacity Aplica texto ou imagem sobre a foto
resize width, height, fit, background Redimensiona (cover, contain, fill)
crop x, y, width, height Corta uma área específica da imagem
flip buffer Espelhamento horizontal
flop buffer Espelhamento vertical

Modos de Compressão

· aggressive: Máxima compressão (pode perder qualidade)
· balanced: Equilíbrio entre tamanho e qualidade (recomendado)
· quality: Prioriza qualidade visual

Posições de Marca d'água

· top-left, top-center, top-right
· center-left, center, center-right
· bottom-left, bottom-center, bottom-right

---

📂 Estrutura de Fontes

Para que a marca d'água de texto funcione perfeitamente, mantenha sua fonte em:

```
./fontes/SNPro-Bold.ttf
```

Você pode usar qualquer fonte TrueType (.ttf). Se a fonte não for encontrada, a lib usará uma fonte padrão do sistema.

---

💡 Casos de Uso

Bot do WhatsApp

```javascript
// Comprime imagem antes de enviar
const { buffer } = await compress(imagemOriginal, { maxSizeKB: 150 });
await sock.sendMessage(chatId, { image: buffer });
```

Gerador de Thumbnails

```javascript
const thumb = await resize(foto, { 
  width: 300, 
  height: 300, 
  fit: 'cover' 
});
```

Proteção de Conteúdo

```javascript
const protegida = await watermark(foto, {
  text: '© 2024 Seu Nome',
  position: 'bottom-right',
  opacity: 0.6
});
```

---

🤝 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (git checkout -b feature/NovaFeature)
3. Commit suas mudanças (git commit -m 'feat: adiciona nova feature')
4. Push para a Branch (git push origin feature/NovaFeature)
5. Abra um Pull Request

---

📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

👤 Autor

Ytsixx

· GitHub: @Ytsixx
· NPM: ffsixx

---

Desenvolvido com ⚡ por FFSIXX Team