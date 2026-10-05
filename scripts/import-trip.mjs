// 把一個資料夾的照片匯入成一次旅行：依拍攝時間排序，時間相近的照片合成一個片刻。
//
//   npm run import-trip -- <照片資料夾> <旅行名稱> [--gap 分鐘] [--tz 時區]
//   npm run import-trip -- ~/Desktop/京都 京都
//   npm run import-trip -- ~/Desktop/京都 京都 --gap 60 --tz Asia/Tokyo
//
// --gap  幾分鐘內拍的照片算同一個片刻，預設 30
// --tz   這次旅行的時區，例如 Asia/Tokyo；省略時依照片裡的時區自動判斷
//
// 照片會縮圖、轉成 JPEG，並移除 EXIF（含 GPS 位置）。文字與地點可以之後再補。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import { site } from '../site.config.ts';

const ROOT = 'content/trips';
const MAX_EDGE = 2048;
const IMAGE = /^\.(jpe?g|png|heic|heif|webp|tiff?)$/i;

// 參數
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const gapMinutes = Number(flag('gap') ?? 30);
let timeZone = flag('tz');
const [folder, title] = args;
if (!folder || !title) {
  console.error('用法：npm run import-trip -- <照片資料夾> <旅行名稱> [--gap 分鐘] [--tz 時區]');
  process.exit(1);
}
if (!existsSync(folder)) {
  console.error(`找不到資料夾：${folder}`);
  process.exit(1);
}

// "+09:00" 轉成分鐘
const offsetMinutes = (o) => {
  const m = o?.match(/^([+-])(\d\d):?(\d\d)$/);
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : null;
};
const formatOffset = (min) => {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};
// 某時區在某時間點的 UTC 偏移（分鐘）
function zoneOffset(zone, date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName').value;
  return name === 'GMT' ? 0 : offsetMinutes(name.replace('GMT', ''));
}

// 讀每張照片的拍攝時間
const files = readdirSync(folder)
  .filter((f) => IMAGE.test(extname(f)) && !f.startsWith('.'))
  .map((f) => join(folder, f));
if (files.length === 0) {
  console.error('資料夾裡沒有照片（支援 JPG、PNG、HEIC、WebP）。');
  process.exit(1);
}

const photos = [];
const noDate = [];
for (const file of files) {
  let exif = null;
  try {
    // 先讀進記憶體再解析（exifr 直接讀檔在新版 Node 會出錯）
    exif = await exifr.parse(readFileSync(file), { pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime'], reviveValues: false });
  } catch {}
  const raw = exif?.DateTimeOriginal ?? exif?.CreateDate;
  const m = typeof raw === 'string' && raw.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
  if (!m) {
    noDate.push(file);
    continue;
  }
  photos.push({
    file,
    local: { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] },
    offset: offsetMinutes(exif.OffsetTimeOriginal ?? exif.OffsetTime),
  });
}
// 讀不到拍攝時間的照片無法排進時間線，直接略過（檔案時間通常是匯出的時間，不可靠）
if (noDate.length) {
  console.warn(`有 ${noDate.length} 張照片讀不到拍攝時間，已略過：`);
  for (const f of noDate) console.warn(`  ${f}`);
}
if (photos.length === 0) {
  console.error('沒有任何照片讀得到拍攝時間。從「照片」App 匯出時，請選擇保留原始資訊（或「匯出未修改的原件」）。');
  process.exit(1);
}

// 決定時區：照片裡最常見的偏移，換成固定偏移的時區（例如 +09:00 → Etc/GMT-9）
if (!timeZone) {
  const counts = new Map();
  for (const p of photos) if (p.offset !== null) counts.set(p.offset, (counts.get(p.offset) ?? 0) + 1);
  const common = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (common === undefined || common % 60 !== 0) timeZone = site.timeZone;
  else if (zoneOffset(site.timeZone, new Date()) === common) timeZone = site.timeZone;
  else timeZone = common === 0 ? 'Etc/UTC' : `Etc/GMT${common > 0 ? '-' : '+'}${Math.abs(common / 60)}`;
}

// 換算成實際時間點；照片沒有時區資訊時，當作旅行時區的當地時間
for (const p of photos) {
  const { y, mo, d, h, mi, s } = p.local;
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = p.offset ?? zoneOffset(timeZone, new Date(guess));
  p.date = new Date(guess - offset * 60000);
}
photos.sort((a, b) => a.date - b.date || a.file.localeCompare(b.file));

// 時間相近的照片合成一個片刻
const moments = [];
for (const p of photos) {
  const last = moments.at(-1);
  if (last && p.date - last.photos.at(-1).date <= gapMinutes * 60000) last.photos.push(p);
  else moments.push({ date: p.date, photos: [p] });
}

// 在旅行時區的當地時間
function local(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  return { ...parts, offset: formatOffset(zoneOffset(timeZone, date)) };
}

// 建立旅行資料夾
const first = local(moments[0].date);
let name = `${first.year}-${first.month}-${first.day}`;
for (let n = 2; existsSync(`${ROOT}/${name}`); n++) name = `${first.year}-${first.month}-${first.day}-${n}`;
const dir = `${ROOT}/${name}/moments`;
mkdirSync(dir, { recursive: true });
writeFileSync(
  `${ROOT}/${name}/index.md`,
  [
    '---',
    `title: ${JSON.stringify(title)}`,
    `# summary: 一句話介紹這次旅行`,
    `# cover: ./moments/檔名.jpg`,
    `timeZone: ${timeZone}`,
    '---',
    '',
  ].join('\n'),
);

// HEIC 等 sharp 讀不了的格式，用 macOS 內建的 sips 先轉成 JPEG
const scratch = mkdtempSync(join(tmpdir(), 'import-trip-'));
// （iPhone 的 HEIC 用 HEVC 壓縮，sharp 看得懂檔頭卻無法解碼，所以一律先轉）
async function load(file) {
  if (!/\.hei[cf]$/i.test(file)) {
    try {
      await sharp(file).resize(8).toBuffer();
      return file;
    } catch {}
  }
  const out = join(scratch, `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', file, '--out', out], { stdio: 'ignore' });
  } catch {
    throw new Error('無法轉換這個格式。HEIC 需要在 macOS 上執行，或先把照片轉成 JPEG');
  }
  return out;
}

let count = 0;
const used = new Set();
for (const moment of moments) {
  const p = local(moment.date);
  let stamp = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
  for (let n = 2; used.has(stamp); n++) stamp = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}-${n}`;
  used.add(stamp);
  const images = [];
  for (const [i, photo] of moment.photos.entries()) {
    const file = `${stamp}-${i + 1}.jpg`;
    try {
      // rotate() 依 EXIF 轉正；sharp 預設不保留 EXIF，GPS 等資訊會一併移除
      await sharp(await load(photo.file))
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(`${dir}/${file}`);
      images.push(file);
      count++;
    } catch (err) {
      console.warn(`略過無法處理的照片：${photo.file}（${err.message}）`);
    }
  }
  if (images.length === 0) continue;
  writeFileSync(
    `${dir}/${stamp}.md`,
    [
      '---',
      `date: ${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.offset}`,
      `# place: 地點`,
      'images:',
      ...images.map((f) => `  - ./${f}`),
      '---',
      '',
    ].join('\n'),
  );
}

const last = local(moments.at(-1).date);
console.log(`
已匯入「${title}」：${count} 張照片，${moments.length} 個片刻
${first.year}.${first.month}.${first.day} — ${last.year}.${last.month}.${last.day}，時區 ${timeZone}

  ${resolve(ROOT, name)}

接下來：
  1. 想補文字，打開 moments/ 裡的 .md，在 --- 下面寫；地點把 # place 前面的 # 拿掉再填。
  2. 在 index.md 補上 summary 與 cover（選填）。
  3. npm run dev 預覽，沒問題就 git add -A && git commit -m "${title}" && git push
`);
