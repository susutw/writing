// 產生「加入主畫面」用的 icon。
// 把一張正方形圖片命名為 icon.png / icon.jpg / icon.svg 放在專案根目錄，執行 npm run icons。
import { existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const source = ['icon.png', 'icon.jpg', 'icon.jpeg', 'icon.svg'].find((f) => existsSync(f));
if (!source) {
  console.error('找不到 icon 圖片：請在專案根目錄放 icon.png、icon.jpg 或 icon.svg');
  process.exit(1);
}

// iOS 會把透明處填成黑色，所以先鋪上背景色（和網站底色一致）
const background = process.argv[2] || '#f7f5f0';
const sizes = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

mkdirSync('public/icons', { recursive: true });
// 圖片完整縮放進正方形（不裁切），四周留 10% 空白
const padding = 0.1;
for (const [name, size] of sizes) {
  const inner = Math.round(size * (1 - padding * 2));
  const image = await sharp(source, { density: 300 })
    .resize(inner, inner, { fit: 'contain', background: '#0000' })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: image, gravity: 'center' }])
    .flatten({ background })
    .png()
    .toFile(`public/icons/${name}`);
  console.log(`public/icons/${name}  ${size}x${size}`);
}
