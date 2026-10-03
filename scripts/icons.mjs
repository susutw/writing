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
// [輸出路徑, 尺寸, 四周留白比例]；瀏覽器分頁的 favicon 很小，留白少一點
const outputs = [
  ['public/icons/apple-touch-icon.png', 180, 0.1],
  ['public/icons/icon-192.png', 192, 0.1],
  ['public/icons/icon-512.png', 512, 0.1],
  ['public/favicon.png', 64, 0.03],
];

mkdirSync('public/icons', { recursive: true });
// 圖片完整縮放進正方形（不裁切），四周留白
for (const [file, size, padding] of outputs) {
  const inner = Math.round(size * (1 - padding * 2));
  const image = await sharp(source, { density: 300 })
    .resize(inner, inner, { fit: 'contain', background: '#0000' })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: image, gravity: 'center' }])
    .flatten({ background })
    .png()
    .toFile(file);
  console.log(`${file}  ${size}x${size}`);
}
