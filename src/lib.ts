import { getCollection, type CollectionKey, type CollectionEntry } from 'astro:content';
import { site } from '../site.config';

/** 取得已發布的項目，依日期新到舊排序 */
export async function published<K extends CollectionKey>(name: K) {
  const items = await getCollection(name, ({ data }) => !(data as { draft?: boolean }).draft);
  return items.sort(
    (a, b) =>
      (b.data as { date: Date }).date.valueOf() - (a.data as { date: Date }).date.valueOf(),
  );
}

/** 站內連結加上 base 路徑，例如部署在 /quiet-pages/ 底下時 */
export function url(path: string) {
  if (/^[a-z]+:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

/** 把 podcast 單集網址轉成嵌入播放器網址；已經是嵌入網址就原樣使用 */
export function podcastEmbed(episode: string) {
  // SoundOn：https://player.soundon.fm/p/<節目>/episodes/<單集>
  const soundon = episode.match(/player\.soundon\.fm\/p\/([\w-]+)\/episodes\/([\w-]+)/);
  if (soundon) return `https://player.soundon.fm/embed/?podcast=${soundon[1]}&episode=${soundon[2]}`;
  return episode;
}

/** 去掉 photos 資料夾 id 結尾的 /index */
export function slug(id: string) {
  return id.replace(/\/index$/, '');
}

function parts(date: Date, timeZone = site.timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return p as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

/** 2026.10.03 */
export function formatDate(date: Date, timeZone?: string) {
  const p = parts(date, timeZone);
  return `${p.year}.${p.month}.${p.day}`;
}

/** 2026.10.03 21:40 */
export function formatDateTime(date: Date, timeZone?: string) {
  const p = parts(date, timeZone);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

/** 21:40 */
export function formatTime(date: Date, timeZone?: string) {
  const p = parts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** 10.03 */
export function formatMonthDay(date: Date, timeZone?: string) {
  const p = parts(date, timeZone);
  return `${p.month}.${p.day}`;
}

/** 2026-10-03，用來把同一天的項目分在一起 */
export function dayKey(date: Date, timeZone?: string) {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 兩個 dayKey 之間相差幾天 */
export function daysBetween(a: string, b: string) {
  const toUtc = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** 2026.09.12 — 09.18；跨年時兩邊都寫年份 */
export function formatRange(start: Date, end: Date, timeZone?: string) {
  const a = parts(start, timeZone);
  const b = parts(end, timeZone);
  const left = `${a.year}.${a.month}.${a.day}`;
  if (dayKey(start, timeZone) === dayKey(end, timeZone)) return left;
  const right = a.year === b.year ? `${b.month}.${b.day}` : `${b.year}.${b.month}.${b.day}`;
  return `${left} — ${right}`;
}

export interface Trip {
  entry: CollectionEntry<'trips'>;
  slug: string;
  timeZone: string;
  moments: CollectionEntry<'moments'>[];
  start: Date;
  end: Date;
  days: number;
  photos: CollectionEntry<'moments'>['data']['images'];
}

/** 所有旅行與其片刻，依出發日期新到舊排序 */
export async function getTrips(): Promise<Trip[]> {
  const [entries, allMoments] = await Promise.all([
    getCollection('trips', ({ data }) => !data.draft),
    getCollection('moments', ({ data }) => !data.draft),
  ]);
  const result: Trip[] = [];
  for (const entry of entries) {
    const tripSlug = slug(entry.id);
    const timeZone = entry.data.timeZone ?? site.timeZone;
    const moments = allMoments
      .filter((m) => m.id.split('/')[0] === tripSlug)
      .sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
    const start = entry.data.start ?? moments[0]?.data.date;
    const end = entry.data.end ?? moments.at(-1)?.data.date ?? start;
    // 沒有日期的旅行無法排進時間軸
    if (!start || !end) continue;
    const photos = [
      ...(entry.data.cover ? [entry.data.cover] : []),
      ...moments.flatMap((m) => m.data.images),
    ];
    const days = daysBetween(dayKey(start, timeZone), dayKey(end, timeZone)) + 1;
    result.push({ entry, slug: tripSlug, timeZone, moments, start, end, days, photos });
  }
  return result.sort((a, b) => b.start.valueOf() - a.start.valueOf());
}
