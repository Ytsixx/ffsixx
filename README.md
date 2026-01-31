

# 🚀 FFSIXX

**FFSIXX** é uma biblioteca **ultra-leve e poderosa** para manipulação de imagens no **Node.js**, construída sobre o motor do **FFmpeg**.

Diferente de outras libs, a FFSIXX trabalha **100% com Buffers e Streams**, sendo perfeita para **Bots (WhatsApp/Telegram)**, **CLI tools** e ambientes limitados como **Termux**.

![NPM Version](https://img.shields.io/npm/v/ffsixx.svg)
![License](https://img.shields.io/npm/l/ffsixx.svg)
![Downloads](https://img.shields.io/npm/dm/ffsixx.svg)


## ✨ Destaques

- ⚡ **Zero dependências pesadas** — usa o FFmpeg do sistema
- 🎯 **Compressão Inteligente** por tamanho alvo (KB)
- 🤖 **Bot-Ready** (stickers, filtros, molduras)
- 🖋️ **Branding Ready** (marca d'água texto ou logo)
- 🧠 **Smart Resize** (`cover`, `contain`, `fill`)
- 💾 **Stream Friendly** (sem arquivos temporários)
- 🧩 **TypeScript Ready**


## 📦 Instalação

### Pré-requisitos
Certifique-se de ter o **FFmpeg** instalado:

- **Termux:** ```bash pkg install ffmpeg ```
- **Ubuntu/Debian:** ```bash sudo apt install ffmpeg```
- **macOS:** ```bash brew install ffmpeg```

### Pacote
```bash
npm install ffsixx

pnpm add ffsixx
```


🛠️ Como Usar

</details><details>
  <summary><strong>🖼️ Molduras e Filtros</strong></summary>
  ```js
  import { frame, applyFilter } from 'ffsixx';

const moldura = await frame(buffer, {
  color: 'white'
});
```

<details>
  <summary><strong>📉 Compressão Inteligente (Target Size)</strong></summary>
```js
import { compress } from 'ffsixx';

const { buffer, sizeKB } = await compress(img, {
  maxSizeKB: 300
});
```


</details><details>
  <summary><strong>🧩 Stickers (WhatsApp / Telegram)</strong></summary>
```js
  import { sticker } from 'ffsixx';
const res = await sticker(buffer, {
  quality: 80
});
```



</details><details>
  <summary><strong>🖋️ Marca d'água (Branding)</strong></summary>
  ```js
  
  import { watermark } from 'ffsixx';
const res = await watermark(buffer, {
  text: 'SIXX CORE',
  position: 'bottom-right'
});

```

</details>

<details>
  <summary><strong>📚 Ver tabela completa da API</strong></summary>
  
  Função	Parâmetros	Descrição

compress	maxSizeKB, mode, format	Comprime até atingir o peso alvo
sticker	quality	Gera WebP 512x512
frame	color, thickness	Adiciona bordas
applyFilter	name	grayscale, sepia, invert
watermark	text, logo, position	Marca d'água
resize	width, height, fit	cover, contain, fill
crop	x, y, width, height	Recorte
flip / flop	buffer	Espelhamento


</details>

📂 Fontes para Marca d'Água

Para texto customizado, coloque sua fonte em:

./fontes/SNPro-Bold.ttf

Caso não exista, a FFSIXX usa a fonte padrão do sistema.


🤝 Contribuição

1. Fork o projeto


2. Crie uma branch:
git checkout -b feature/NovaFeature


3. Commit: git commit -m "feat: nova ferramenta"


4. Abra um Pull Request




📝 Licença

Licença MIT.


👤 Autor

Ytsixx

* 🐙 GitHub: [@Ytsixx](https://github.com/Ytsixx)
* 📦 NPM: [ffsixx](https://www.npmjs.com/package/ffsixx)



<details>
  <summary><strong>👀 Clique para ver mais</strong></summary>Aqui fica o conteúdo escondido 😈
Pode ter texto, listas, código, links, tudo.
```js
console.log("sixx.js </>");
```
</details>

Desenvolvido com ⚡ por FFSIXX Team


💣 **Resultado:**  
- README **limpo**
- Conteúdo avançado **oculto**
- Profissional pra **npm + GitHub**
- Cara de projeto grande 😎

Se quiser, próximo nível:
- 🛡️ Badges extras (coverage, size, types)
- 📊 GIF de demonstração
- 🧠 Docs separada (`/docs`)
- 🧪 Seção de benchmarks
