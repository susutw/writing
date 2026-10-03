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
for (const [name, size] of sizes) {
  await sharp(source, { density: 300 })
    .resize(size, size, { fit: 'cover' })
    .flatten({ background })
    .png()
    .toFile(`public/icons/${name}`);
  console.log(`public/icons/${name}  ${size}x${size}`);
}
