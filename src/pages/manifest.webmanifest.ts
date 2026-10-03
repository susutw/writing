import type { APIRoute } from 'astro';
import { site } from '../../site.config';
import { url } from '../lib';

// 加入主畫面時使用的設定
export const GET: APIRoute = () => {
  const manifest = {
    name: site.title,
    short_name: site.app.shortName || site.title,
    description: site.description.replace(/\s*\n\s*/g, ' '),
    lang: site.lang,
    start_url: url('/'),
    scope: url('/'),
    display: 'standalone',
    background_color: site.app.themeColor,
    theme_color: site.app.themeColor,
    icons: [
      { src: url('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: url('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
};
