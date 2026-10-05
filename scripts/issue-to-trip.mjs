// 把 issue 轉成旅行中的一個片刻，加進 content/trips/<旅行>/moments/。
// issue 標題是旅行名稱：同名、而且日期接近（前後七天內）的旅行會放在一起，找不到就建立新的旅行。
// 內文第一行可以用 @ 寫地點與時間，補記過去的旅行時使用：
//   @ 鴨川
//   @ 14:30 鴨川
//   @ 2023-05-02 14:30 清水寺
// 由 .github/workflows/issue-to-trip.yml 呼叫。
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const { BODY = '', TITLE = '', CREATED, TIME_ZONE = 'Asia/Taipei', GH_TOKEN, GITHUB_OUTPUT } = process.env;
const DEFAULT_TITLE = '行旅';
const ROOT = 'content/trips';
const MAX_EDGE = 2048;
const NEAR = 7 * 86400000;

function output(key, value) {
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  else console.log(`${key}=${value}`);
}

function fail(message) {
  output('error', message);
  console.error(message);
  process.exit(0);
}

// 某個時區在某個時間點的各欄位與 UTC 偏移
function local(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const offset = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.replace('GMT', '');
  const [, sign, hh, mm] = offset.match(/([+-])(\d\d):(\d\d)/);
  const minutes = (sign === '-' ? -1 : 1) * (+hh * 60 + +mm);
  return { ...p, offset, minutes };
}

// 把某時區的當地時間換成實際時間點
function fromLocal(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let instant = guess - local(new Date(guess), timeZone).minutes * 60000;
  instant = guess - local(new Date(instant), timeZone).minutes * 60000;
  return new Date(instant);
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const get = (key) => {
    const v = m?.[1].match(new RegExp(`^${key}:\\s*(.+?)\\s*(?:#.*)?$`, 'm'))?.[1];
    return v?.replace(/^["']|["']$/g, '');
  };
  return get;
}

// 讀取現有的旅行
function readTrips() {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(`${ROOT}/${d.name}/index.md`))
    .map((d) => {
      const get = frontmatter(readFileSync(`${ROOT}/${d.name}/index.md`, 'utf8'));
      const dir = `${ROOT}/${d.name}/moments`;
      const dates = existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
            .map((f) => new Date(frontmatter(readFileSync(`${dir}/${f}`, 'utf8'))('date')))
            .filter((x) => !isNaN(x))
        : [];
      for (const key of ['start', 'end']) {
        const v = get(key);
        if (v) dates.push(new Date(v));
      }
      const times = dates.map((x) => x.valueOf());
      return {
        name: d.name,
        title: get('title'),
        timeZone: get('timeZone') || TIME_ZONE,
        start: times.length ? Math.min(...times) : null,
        end: times.length ? Math.max(...times) : null,
      };
    });
}

const title = TITLE.trim();
if (!title || title === DEFAULT_TITLE) fail('請把 issue 標題改成這次旅行的名稱，例如「京都」，再移除並加回 trip label。');

// 內文：去掉範本註解，取出 @ 那一行與照片
let text = BODY.replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
let meta = null;
const firstLine = text.split('\n')[0];
if (firstLine.startsWith('@')) {
  meta = firstLine.slice(1).trim();
  text = text.slice(firstLine.length);
}
const urls = [];
text = text.replace(/!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/g, (_, url) => (urls.push(url), ''));
text = text.replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi, (_, url) => (urls.push(url), ''));
text = text.replace(/\n{3,}/g, '\n\n').trim();
if (!text && urls.length === 0) fail('內文是空的，沒有發布。寫好內容後，移除並加回 trip label 就會重新處理。');

let place = '';
let when = null; // { y, mo, d, h, mi }，沒有寫就用送出的時間
if (meta) {
  const m = meta.match(/^(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2}))?\s*(?:(\d{1,2}):(\d{2}))?\s*(.*)$/);
  place = m[6].trim();
  if (m[1] || m[4]) when = { date: m[1] ? [+m[1], +m[2], +m[3]] : null, time: m[4] ? [+m[4], +m[5]] : null };
}

const created = new Date(CREATED);
function momentDate(timeZone) {
  if (!when) return created;
  const now = local(created, timeZone);
  const [y, mo, d] = when.date ?? [+now.year, +now.month, +now.day];
  // 只寫日期沒寫時間時，放在當天中午
  const [h, mi] = when.time ?? (when.date ? [12, 0] : [+now.hour, +now.minute]);
  return fromLocal(y, mo, d, h, mi, timeZone);
}

// 找同名而且日期接近的旅行
const trips = readTrips();
let trip = null;
let date = null;
for (const t of trips.filter((t) => t.title === title)) {
  const candidate = momentDate(t.timeZone);
  if (t.start === null || (candidate >= t.start - NEAR && candidate <= t.end + NEAR)) {
    trip = t;
    date = candidate;
    break;
  }
}
let createdTrip = false;
if (!trip) {
  date = momentDate(TIME_ZONE);
  const p = local(date, TIME_ZONE);
  let name = `${p.year}-${p.month}-${p.day}`;
  for (let n = 2; existsSync(`${ROOT}/${name}`); n++) name = `${p.year}-${p.month}-${p.day}-${n}`;
  mkdirSync(`${ROOT}/${name}/moments`, { recursive: true });
  writeFileSync(`${ROOT}/${name}/index.md`, `---\ntitle: ${JSON.stringify(title)}\n---\n`);
  trip = { name, title, timeZone: TIME_ZONE };
  createdTrip = true;
}

const dir = `${ROOT}/${trip.name}/moments`;
mkdirSync(dir, { recursive: true });
const p = local(date, trip.timeZone);
const stampBase = `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
let stamp = stampBase;
for (let n = 2; existsSync(`${dir}/${stamp}.md`); n++) stamp = `${stampBase}-${n}`;

async function download(url) {
  let res = await fetch(url);
  if (!res.ok && GH_TOKEN) res = await fetch(url, { headers: { Authorization: `Bearer ${GH_TOKEN}` } });
  if (!res.ok) throw new Error(`下載失敗（${res.status}）：${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const files = [];
try {
  for (const [i, url] of urls.entries()) {
    const name = `${stamp}-${i + 1}.jpg`;
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

const lines = ['---', `date: ${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.offset}`];
if (place) lines.push(`place: ${JSON.stringify(place)}`);
if (files.length) lines.push('images:', ...files.map((f) => `  - ./${f}`));
lines.push('---', '');
if (text) lines.push(text, '');
writeFileSync(`${dir}/${stamp}.md`, lines.join('\n'));

console.log(`trip: ${trip.name}${createdTrip ? ' (new)' : ''}`);
console.log(lines.join('\n'));
output('dir', `${ROOT}/${trip.name}`);
output('slug', trip.name);
output('title', title);
output('new', createdTrip ? 'true' : '');
