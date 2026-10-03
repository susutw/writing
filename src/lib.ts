import { getCollection, type CollectionKey } from 'astro:content';
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

function parts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: site.timeZone,
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
export function formatDate(date: Date) {
  const p = parts(date);
  return `${p.year}.${p.month}.${p.day}`;
}

/** 2026.10.03 21:40 */
export function formatDateTime(date: Date) {
  const p = parts(date);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}
