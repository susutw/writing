import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 文章：content/blog/<slug>.md 或 content/blog/<slug>/index.md
const blog = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// 圖文：每篇一個資料夾 content/photos/<slug>/index.md，照片放在同一個資料夾
const photos = defineCollection({
  loader: glob({ pattern: ['**/index.md', '!**/_*/**'], base: './content/photos' }),
  schema: ({ image }) =>
    z.object({
      date: z.coerce.date(),
      title: z.string().optional(),
      images: z.array(image()).min(1),
      draft: z.boolean().default(false),
    }),
});

// 短文：content/notes/<任意檔名>.md，只需要 date
const notes = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './content/notes' }),
  schema: z.object({
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

// Podcast：content/podcast/<任意檔名>.md，貼上單集網址即可
const podcast = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!**/_*'], base: './content/podcast' }),
  schema: z.object({
    date: z.coerce.date(),
    episode: z.string().url(),
    draft: z.boolean().default(false),
  }),
});

// 行旅：每次旅行一個資料夾 content/trips/<旅行>/index.md
// 起訖日期可省略，會從片刻自動計算
const trips = defineCollection({
  loader: glob({ pattern: ['*/index.md', '!_*/**'], base: './content/trips' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string().nullish(),
      cover: image().nullish(),
      start: z.coerce.date().optional(),
      end: z.coerce.date().optional(),
      // 這次旅行的時區，例如 Asia/Tokyo；省略就用 site.config.ts 的 timeZone
      timeZone: z.string().nullish(),
      draft: z.boolean().default(false),
    }),
});

// 旅行中的片刻：content/trips/<旅行>/moments/<任意檔名>.md
const moments = defineCollection({
  loader: glob({ pattern: ['*/moments/*.md', '!_*/**', '!*/moments/_*'], base: './content/trips' }),
  schema: ({ image }) =>
    z.object({
      date: z.coerce.date(),
      place: z.string().nullish(),
      images: z.array(image()).nullish().transform((v) => v ?? []),
      draft: z.boolean().default(false),
    }),
});

// 檔名或資料夾名以 _ 開頭的會被略過，用來放範例或暫存。
export const collections = { blog, photos, notes, podcast, trips, moments };
