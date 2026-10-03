# quiet-pages

一個簡約、安靜的個人網站模板。三個分頁：

- **文章**：一般部落格，標題、日期、內文。
- **圖文**：像相片牆一樣的方格，點進去看完整照片與文字。
- **短文**：像推特一樣一則一則串在一起，只顯示發布的日期與時間。

所有內容都是資料夾裡的 Markdown 檔，不需要資料庫或後台。使用 [Astro](https://astro.build) 產生純靜態網站，可以部署到 GitHub Pages、Netlify、Vercel 等任何靜態主機。

## 開始使用

需要 Node.js 22.12 以上。

```sh
npm install
npm run dev      # 本機預覽 http://localhost:4321
npm run build    # 輸出到 dist/
```

## 設定

編輯 `site.config.ts`：網站名稱、作者、時區、首頁顯示哪個分頁、分頁名稱。
部署前把 `astro.config.mjs` 裡的 `site` 改成你的網址。

## 寫內容

```
content/
  blog/
    _example.md                   範例（不會顯示在網站上）
    on-walking.md                 一篇文章一個檔案
    hello/index.md                也可以用資料夾，圖片放旁邊
  photos/
    _example/                     範例（不會顯示在網站上）
    2026-09-14-harbor/            一則圖文一個資料夾
      index.md
      1.jpg
      2.jpg
  notes/
    _example.md                   範例（不會顯示在網站上）
    2026-10-03-2140.md            檔名隨意，建議用日期時間
```

**檔名或資料夾名以 `_` 開頭的不會出現在網站上。** 每種內容都附了一個 `_example`，裡面有各欄位的說明，複製一份、去掉開頭的 `_` 就能開始寫。

### 文章 `content/blog/*.md`

```md
---
title: 散步
date: 2026-09-18
description: 可省略
---

內文。
```

### 圖文 `content/photos/<資料夾>/index.md`

```md
---
date: 2026-09-14T17:45:00+08:00
title: 港邊          # 可省略
images:
  - ./1.png         # 第一張是相片牆上的封面
  - ./2.png
---

說明文字，可省略。
```

### 短文 `content/notes/*.md`

```md
---
date: 2026-10-03T21:40:00+08:00
---

短短的一段話。
```

短文只需要 `date`。請寫完整時間與時區（`+08:00`），網站會依 `site.config.ts` 的時區顯示為 `2026.10.03 21:40`。

### 草稿

任何內容加上 `draft: true` 就不會發布。

## icon（主畫面與瀏覽器分頁）

網站支援手機的「加入主畫面」，打開時不會有瀏覽器網址列。

1. 準備一張圖片（建議至少 512×512，不是正方形也可以，會完整放進正方形、四周留白），命名為 `icon.png`、`icon.jpg` 或 `icon.svg`，放在專案根目錄，取代原本的 `icon.svg`。
2. 執行 `npm run icons`，會產生 iPhone 與 Android 需要的尺寸（`public/icons/`），以及瀏覽器分頁的小圖示（`public/favicon.png`）。
3. 在 `site.config.ts` 的 `app` 可以設定主畫面上顯示的名稱與狀態列顏色。

iPhone 不支援透明背景，透明的地方會填上網站底色；想換底色可以執行 `npm run icons -- '#ffffff'`。

## 部署到 GitHub Pages

已經附好 `.github/workflows/deploy.yml`，推上 `main` 就會自動 build 並部署。

1. 用 **Use this template** 建立你自己的 repo。
2. 到 repo 的 **Settings → Pages**，把 **Source** 選成 **GitHub Actions**。
3. 推一次 `main`（或到 Actions 手動執行 Deploy to GitHub Pages）。

網址與子路徑（例如 `https://你的帳號.github.io/repo名稱/`）會自動帶入，不需要另外設定。

部署到 Netlify、Vercel 等其他地方：build 指令是 `npm run build`，輸出資料夾是 `dist`，並把 `astro.config.mjs` 的 `site` 改成你的網址。

## 風格

- 襯線字體（Noto Serif TC），米白底色，自動支援深色模式。
- 樣式集中在 `src/styles/global.css` 的 CSS 變數，改顏色與寬度只需動最上面幾行。

## 授權

MIT
