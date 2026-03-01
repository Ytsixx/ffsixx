<p align="center">
  <img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/ec559a9f6bfd399b82bb44393651661b08aaf7ba/icons/folder-markdown-open.svg" width="25%">
</p>

<h1 align="center">ffsixx</h1>

<p align="center">
  <em>Ultra-lightweight image manipulation library powered by FFmpeg for Node.js</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/Ytsixx/ffsixx?style=default&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
  <img src="https://img.shields.io/github/last-commit/Ytsixx/ffsixx?style=default&logo=git&logoColor=white&color=0080ff" alt="last-commit">
  <img src="https://img.shields.io/npm/v/ffsixx?style=default&color=0080ff" alt="npm version">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D16-brightgreen?style=default&color=0080ff" alt="node">
  <img src="https://img.shields.io/badge/FFmpeg-required-orange?style=default&color=0080ff" alt="ffmpeg">
</p>

---

## 🔗 Table of Contents

- [📍 Overview](#-overview)
- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [📖 API Reference](#-api-reference)
  - [🔧 Core](#-core)
  - [🔄 Transformations](#-transformations)
  - [🎨 Effects](#-effects)
  - [🖼️ Composition](#-composition)
  - [🛠️ Utilities](#-utilities)
  - [🎬 Animation](#-animation)
- [📁 Project Structure](#-project-structure)
- [🧪 Testing](#-testing)
- [🔰 Contributing](#-contributing)
- [🎗 License](#-license)

---

## 📍 Overview

**ffsixx** is a zero-config, stream-based image manipulation library for Node.js. It wraps FFmpeg's powerful filter graph into a clean, modern ES Module API — with no native bindings, no heavy C++ compilation, and full Termux/Android support.

All functions work with **Buffers in, Buffers out**, making ffsixx a drop-in for any bot, API, or pipeline.

---

## ✨ Features

- 🚀 **31 tools** covering compression, effects, composition, animation, and utilities
- 📦 **Buffer-first API** — no file system required, works entirely in memory
- 📱 **Termux/Android compatible** — no native bindings, pure FFmpeg
- 🎯 **Rich return objects** — every function returns metadata alongside the buffer
- 🧪 **102 tests passing** — fully covered with Mocha

---

## 📦 Installation

```sh
npm install ffsixx
# or
pnpm add ffsixx
```

> **Requirement:** FFmpeg must be installed and available in your system PATH.
>
> ```sh
> # Ubuntu / Debian
> apt install ffmpeg
>
> # Termux
> pkg install ffmpeg
>
> # macOS
> brew install ffmpeg
> ```

---

## 🚀 Quick Start

```js
import { resize, compress, sticker, applyFilter } from 'ffsixx';
import { readFile, writeFile } from 'fs/promises';

const image = await readFile('./photo.jpg');

// Resize
const resized = await resize(image, { width: 800, height: 600, fit: 'cover' });

// Compress to max 200KB
const compressed = await compress(image, { maxSizeKB: 200 });

// WhatsApp sticker (512x512 WebP)
const stk = await sticker(image);

// Apply grayscale filter
const bw = await applyFilter(image, 'grayscale');

await writeFile('./output.jpg', resized.buffer);
```

---

## 📖 API Reference

All functions return a **result object** containing `buffer` and metadata. Only `toBase64`, `fromBase64`, and `getInfo` are synchronous.

---

### 🔧 Core

#### `compress(buffer, options?)`
Iteratively compresses an image to reach a target file size.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSizeKB` | number | `300` | Target size in KB |
| `quality` | number | `90` | Initial quality (1–100) |
| `mode` | string | `'balanced'` | `'fast'` \| `'balanced'` \| `'precise'` |
| `format` | string | `'jpeg'` | Output format |

```js
const result = await compress(buffer, { maxSizeKB: 150, mode: 'precise' });
// result.buffer, result.sizeKB, result.iterations, result.success
```

---

#### `resize(buffer, options?)`
Resizes an image with multiple fit modes.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | `-1` | Target width (-1 = auto) |
| `height` | number | `-1` | Target height (-1 = auto) |
| `fit` | string | `'cover'` | `'cover'` \| `'contain'` \| `'fill'` |
| `background` | string | `'black'` | Background color for contain mode |
| `upscale` | boolean | `false` | Allow upscaling |

```js
const result = await resize(buffer, { width: 1280, height: 720, fit: 'contain', background: 'white' });
```

---

#### `resizeCover(buffer, options?)`
Shortcut for cover-mode resize. Crops to fill exactly.

```js
const result = await resizeCover(buffer, { width: 500, height: 500 });
```

---

#### `crop(buffer, options?)`
Crops a region from the image.

```js
const result = await crop(buffer, { x: 100, y: 50, width: 400, height: 300 });
```

---

#### `watermark(buffer, options?)`
Adds text or logo watermark.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `text` | string | `''` | Watermark text |
| `logo` | Buffer | `null` | Logo image buffer |
| `position` | string | `'bottom-right'` | `'top-left'` \| `'top-right'` \| `'bottom-left'` \| `'bottom-right'` \| `'center'` |
| `opacity` | number | `0.5` | Opacity (0–1) |
| `fontSize` | number | `40` | Font size |
| `color` | string | `'white'` | Text color |

```js
const result = await watermark(buffer, { text: '© ffsixx', opacity: 0.7 });
```

---

#### `flip(buffer)` / `flop(buffer)`
Mirrors horizontally (flip) or vertically (flop).

```js
const h = await flip(buffer); // horizontal mirror
const v = await flop(buffer); // vertical mirror
```

---

#### `sticker(buffer, options?)`
Converts image to WhatsApp-compatible 512×512 WebP sticker.

```js
const result = await sticker(buffer, { quality: 80 });
// result.format === 'webp', result.type === 'sticker'
```

---

#### `frame(buffer, options?)`
Adds a decorative frame with vignette effect.

```js
const result = await frame(buffer, { color: 'white', thickness: 20 });
```

---

#### `applyFilter(buffer, filterType, options?)`
Applies one of the built-in filters.

| filterType | Description |
|------------|-------------|
| `'grayscale'` | Black & white |
| `'sepia'` | Warm vintage tone |
| `'blur'` | Gaussian blur |
| `'vintage'` | Aged film look |
| `'edge'` | Edge detection |
| `'negative'` | Color inversion |
| `'mirror'` | Flip (use `options.vertical: true` for vertical) |
| `'pixelate'` | Pixel art effect |

```js
const result = await applyFilter(buffer, 'blur', { value: 10 });
const result = await applyFilter(buffer, 'pixelate', { value: 15 });
```

---

### 🔄 Transformations

#### `rotate(buffer, options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `angle` | `90` | Degrees (supports any angle) |
| `background` | `'black'` | Fill color for free-angle rotation |
| `expand` | `true` | Expand canvas to avoid cropping |

```js
const result = await rotate(buffer, { angle: 45, background: 'white' });
```

---

#### `sharpen(buffer, options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `strength` | `1.5` | Positive = sharpen, negative = blur |
| `radius` | `5` | Kernel size (must be odd, 3–23) |
| `mode` | `'sharpen'` | `'sharpen'` \| `'blur'` \| `'unsharp'` |

```js
const result = await sharpen(buffer, { strength: 3, mode: 'sharpen' });
```

---

#### `adjust(buffer, options?)`
Adjusts brightness, contrast, saturation and gamma in one pass.

```js
const result = await adjust(buffer, {
  brightness: 0.1,   // -1.0 to 1.0
  contrast: 1.3,     // -1000 to 1000
  saturation: 1.5,   // 0 to 3
  gamma: 1.1         // 0.1 to 10
});
```

---

#### `vignette(buffer, options?)`

```js
const result = await vignette(buffer, { angle: 30, strength: 0.7 });
```

---

#### `perspective(buffer, options?)`
Applies trapezoidal perspective distortion.

```js
const result = await perspective(buffer, { direction: 'right', strength: 40 });
// directions: 'left' | 'right' | 'top' | 'bottom'
```

---

### 🎨 Effects

#### `glitch(buffer, options?)`
Digital glitch / corruption effect.

```js
const result = await glitch(buffer, { strength: 15, mode: 'rgb' });
// modes: 'rgb' | 'scan' | 'full'
```

---

#### `sketch(buffer, options?)`
Converts to hand-drawn sketch style.

```js
const result = await sketch(buffer, { mode: 'pencil', strength: 6 });
// modes: 'pencil' | 'ink' | 'charcoal'
```

---

#### `cartoon(buffer, options?)`
Flat-color cartoon / cel-shading effect.

```js
const result = await cartoon(buffer, { colors: 6, edges: 4 });
```

---

#### `emboss(buffer, options?)`
3D relief / emboss effect.

```js
const result = await emboss(buffer, { mode: 'gray', strength: 5, direction: 'tl' });
// modes: 'gray' | 'color'   directions: 'tl' | 'tr' | 'bl' | 'br'
```

---

#### `duotone(buffer, options?)`
Maps shadows and highlights to two custom colors.

```js
const result = await duotone(buffer, {
  shadow: '#1a1a2e',
  highlight: '#e94560',
  strength: 0.85
});
```

---

#### `noise(buffer, options?)`
Adds film grain or digital noise.

```js
const result = await noise(buffer, { strength: 25, type: 'film', color: false });
// types: 'film' | 'digital' | 'soft'
```

---

### 🖼️ Composition

#### `overlay(base, over, options?)`
Overlays one image on top of another.

| Option | Default | Description |
|--------|---------|-------------|
| `opacity` | `1` | Top layer opacity (0–1) |
| `position` | `'center'` | `'center'` \| `'top-left'` \| `'top-right'` \| `'bottom-left'` \| `'bottom-right'` |
| `x` / `y` | `null` | Manual position override |
| `scale` | `1` | Scale of the top layer |

```js
const result = await overlay(background, logo, { opacity: 0.8, position: 'bottom-right' });
```

---

#### `collage(buffers, options?)`
Creates an image grid from multiple buffers.

```js
const result = await collage([img1, img2, img3, img4], {
  columns: 2,
  cellWidth: 400,
  cellHeight: 400,
  gap: 10,
  background: 'white',
  fit: 'cover'
});
// result.width, result.height, result.rows, result.columns
```

---

#### `border(buffer, options?)`

```js
const result = await border(buffer, { thickness: 15, color: 'white', style: 'solid' });
// styles: 'solid' | 'double' | 'shadow'
```

---

#### `shadow(buffer, options?)`

```js
const result = await shadow(buffer, { blur: 20, offsetX: 8, offsetY: 8, opacity: 0.6 });
```

---

### 🛠️ Utilities

#### `dominant(buffer, options?)`
Extracts dominant colors using K-Means clustering.

```js
const result = await dominant(buffer, { count: 5 });
// result.colors[0] = { hex: '#3a2f1c', rgb: { r, g, b }, luminance, isDark }
// result.palette = ['#3a2f1c', '#c8a96e', ...]
```

---

#### `getInfo(buffer)` *(sync)*
Returns image metadata without processing.

```js
const info = getInfo(buffer);
// { width, height, format, megapixels, sizeKB, isLandscape, isPortrait, isSquare }
```

---

#### `strip(buffer)`
Removes all EXIF metadata.

```js
const result = await strip(buffer);
// result.saved = KB removed
```

---

#### `toBase64(buffer, mimeType?)` *(sync)*

```js
const { base64, dataUrl } = toBase64(buffer, 'image/jpeg');
```

---

#### `fromBase64(input)` *(sync)*
Accepts raw base64 string or `data:...;base64,...` dataURL.

```js
const { buffer } = fromBase64(dataUrl);
```

---

#### `placeholder(options?)`
Generates a solid-color image with centered text — useful for mockups and tests.

```js
const result = await placeholder({
  width: 800,
  height: 400,
  color: '#3498db',
  text: 'Hello World',
  textColor: 'white'
});
```

---

### 🎬 Animation

#### `gif(frames, options?)`
Creates an optimized animated GIF from an array of image buffers.

| Option | Default | Description |
|--------|---------|-------------|
| `fps` | `10` | Frames per second (1–30) |
| `width` | `480` | Output width |
| `loop` | `0` | Loop count (0 = infinite) |
| `dither` | `true` | Use Bayer dithering for better quality |

```js
const result = await gif([frame1, frame2, frame3], { fps: 12, width: 320 });
// result.format === 'gif', result.frames === 3
```

---

#### `speed(buffer, options?)`
Speeds up or slows down an animated GIF.

```js
const faster = await speed(gifBuffer, { factor: 2 });   // 2× faster
const slower = await speed(gifBuffer, { factor: 0.5 }); // 2× slower
```

---

## 📁 Project Structure

```sh
ffsixx/
├── index.js              # Entry point — all exports
├── src/
│   ├── applyFilter.js    # Built-in filter pack
│   ├── adjust.js         # Brightness / contrast / saturation / gamma
│   ├── border.js         # Custom border styles
│   ├── cartoon.js        # Cartoon / cel-shading effect
│   ├── circle.js         # Circular crop with transparency
│   ├── collage.js        # Image grid generator
│   ├── compress.js       # Iterative compression
│   ├── convert.js        # Format conversion
│   ├── crop.js           # Region crop
│   ├── dominant.js       # Dominant color extraction (K-Means)
│   ├── duotone.js        # Two-color tone mapping
│   ├── emboss.js         # Relief / emboss effect
│   ├── frame.js          # Decorative frame
│   ├── gif.js            # Animated GIF creator + speed control
│   ├── glitch.js         # Digital glitch effect
│   ├── mirror.js         # Flip / flop
│   ├── noise.js          # Film grain / digital noise
│   ├── overlay.js        # Image compositing
│   ├── perspective.js    # Perspective distortion
│   ├── resize.js         # Smart resize (cover / contain / fill)
│   ├── resizeCover.js    # Cover-mode resize shortcut
│   ├── rotate.js         # Rotation (any angle)
│   ├── shadow.js         # Drop shadow
│   ├── sharpen.js        # Sharpening / blur
│   ├── sketch.js         # Pencil / ink / charcoal sketch
│   ├── sticker.js        # WhatsApp sticker generator
│   ├── utils.js          # strip, toBase64, fromBase64, getInfo, placeholder
│   ├── vignette.js       # Vignette darkening
│   └── watermark.js      # Text / logo watermark
├── database/
│   ├── fontes/           # Bundled fonts (SNPro-Bold.ttf)
│   └── imagem/           # Test images
└── test/
    ├── index.test.js
    ├── resize.test.js
    ├── transformations.test.js
    ├── extras.test.js
    └── newfeatures.test.js
```

---

## 🧪 Testing

```sh
pnpm test
```

102 tests across 5 test files, covering all 31 tools.

---

## 🔰 Contributing

1. Fork the repository
2. Create a new branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Commit: `git commit -m 'feat: add my feature'`
5. Push: `git push origin feature/my-feature`
6. Open a Pull Request

---

## 🎗 License

MIT © [Ytsixx](https://github.com/Ytsixx)

---

<p align="center">Made with ❤️ and FFmpeg</p>
