// 把 issue 轉成一則圖文：下載內文中的照片，縮圖並移除 EXIF（含 GPS 位置），
// 寫入 content/photos/<日期時間>/。由 .github/workflows/issue-to-photo.yml 呼叫。
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const { BODY = '', TITLE = '', CREATED, TIME_ZONE = 'Asia/Taipei', GH_TOKEN, GITHUB_OUTPUT } = process.env;
const DEFAULT_TITLE = '圖文';
const MAX_EDGE = 2048;

function output(key, value) {
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  else console.log(`${key}=${value}`);
}

function fail(message) {
  output('error', message);
  console.error(message);
  process.exit(0);
}

// 依時區取得日期時間各欄位
function parts(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const offset = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.replace('GMT', '');
  return { ...p, offset };
}

// 找出內文裡的圖片：Markdown 的 ![](url) 與 HTML 的 <img src="url">
let text = BODY.replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '');
const urls = [];
text = text.replace(/!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/g, (_, url) => (urls.push(url), ''));
text = text.replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (_, url) => (urls.push(url), ''));
const caption = text.replace(/\n{3,}/g, '\n\n').trim();

if (urls.length === 0) fail('沒有找到照片。把照片貼進內文後，移除再加回 photo label 就會重新處理。');

async function download(url) {
  let res = await fetch(url);
  if (!res.ok && GH_TOKEN) res = await fetch(url, { headers: { Authorization: `Bearer ${GH_TOKEN}` } });
  if (!res.ok) throw new Error(`下載失敗（${res.status}）：${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const p = parts(new Date(CREATED));
const slugBase = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
let slug = slugBase;
for (let n = 2; existsSync(`content/photos/${slug}`); n++) slug = `${slugBase}-${n}`;
const dir = `content/photos/${slug}`;

const files = [];
try {
  mkdirSync(dir, { recursive: true });
  for (const [i, url] of urls.entries()) {
    const name = `${i + 1}.jpg`;
    // rotate() 依 EXIF 轉正；sharp 預設不保留 EXIF，GPS 等資訊會一併移除
    await sharp(await download(url))
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(`${dir}/${name}`);
    files.push(name);
  }
} catch (err) {
  fail(`照片處理失敗：${err.message}`);
}

const title = TITLE.trim();
const lines = ['---', `date: ${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.offset}`];
if (title && title !== DEFAULT_TITLE) lines.push(`title: ${JSON.stringify(title)}`);
lines.push('images:', ...files.map((f) => `  - ./${f}`), '---', '');
if (caption) lines.push(caption, '');
writeFileSync(`${dir}/index.md`, lines.join('\n'));

console.log(lines.join('\n'));
output('dir', dir);
output('slug', slug);
