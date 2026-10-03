// 網站設定：使用這個模板時，主要只需要改這個檔案。
export const site = {
  title: '坐在 4-1 的蘇同學',
  // 顯示在標題下方，可以換行
  description: '寫一些日子、寫想法、寫新的發現。\n文字從單字堆積成文章，再變成你的獨一無二的輪廓。',
  // 頭貼：把圖片放在 public/ 資料夾，填上路徑；留空 '' 就不顯示
  avatar: '/avatar.svg',
  author: '蘇同學',
  lang: 'zh-Hant',
  // 所有日期時間都以這個時區顯示
  timeZone: 'Asia/Taipei',
  // 首頁顯示哪個分頁：'blog' | 'photos' | 'notes'
  home: 'blog' as 'blog' | 'photos' | 'notes',
  tabs: [
    { key: 'blog', label: '文章', href: '/blog/' },
    { key: 'photos', label: '圖文', href: '/photos/' },
    { key: 'notes', label: '短文', href: '/notes/' },
  ],
  footer: '',
  // 字體：從 Google Fonts 載入，name 填 Google Fonts 上的字體名稱
  fonts: {
    // 全站內文
    body: { name: 'Noto Serif TC', weights: '400;600' },
    // 短文（芫荽）。想換成霞鶩文楷就改成 { name: 'LXGW WenKai TC', weights: '400' }
    notes: { name: 'Iansui', weights: '400' },
  },
};
