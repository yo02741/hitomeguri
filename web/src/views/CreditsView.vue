<script setup lang="ts">
// 資料來源（UX-FLOW.md §1.1、DESIGN.md §8）：網站用到的資料、出處與授權，以及注意事項。
// 地圖上只留 © OpenStreetMap © OpenMapTiles 與連到這一頁的「資料來源」。
// 只列實際用到的來源（pipeline/sources、data/ 各檔的 sources），新增來源時一起補上。
import { N03_URL } from '../map/style'

interface Link {
  label: string
  href: string
}
interface Source {
  name: string
  href: string
  /** 用在哪裡 */
  use: string
  /** 授權；有好幾種時依序列出，用「／」隔開 */
  license?: Link | string | Array<Link | string>
  /** 授權以外的附註 */
  note?: string
  /** 來源指定的出典標示（日文，照原文） */
  credit?: string
}

const CC0: Link = { label: 'CC0 1.0', href: 'https://creativecommons.org/publicdomain/zero/1.0/deed.zh-hant' }
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/deed.zh-hant'
const PDL: Link = { label: '公共データ利用規約（第1.0版）', href: 'https://www.jma.go.jp/jma/kishou/info/coment.html' }

const GROUPS: Array<{ id: string; title: string; items: Source[] }> = [
  {
    id: 'map',
    title: '地圖',
    items: [
      {
        name: 'OpenStreetMap',
        href: 'https://www.openstreetmap.org/copyright',
        use: '底圖的地圖資料',
        license: { label: 'ODbL 1.0', href: 'https://opendatacommons.org/licenses/odbl/' },
        note: '© OpenStreetMap contributors',
      },
      {
        name: 'OpenMapTiles',
        href: 'https://www.openmaptiles.org/',
        use: '底圖的圖磚格式與樣式',
        license: { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hant' },
        note: '© OpenMapTiles',
      },
      { name: 'OpenFreeMap', href: 'https://openfreemap.org/', use: '底圖的圖磚與樣式（Positron）' },
      {
        name: '地球地図日本（国土地理院）',
        href: 'https://www.gsi.go.jp/',
        use: '縣界：判斷地圖上的縣、經縣值與分享圖的地圖',
        note: '出典：地球地図日本（国土地理院）。GeoJSON 取自 dataofjapan/land',
      },
      {
        name: '国土数値情報（行政区域データ）',
        href: N03_URL,
        use: '市區町村界：縣地圖的區界與區名、景點清單的地區',
        license: [{ label: 'CC BY 4.0（N03 資料頁）', href: CC_BY }, '公共データ利用規約（第1.0版）'],
        credit: `「国土数値情報（行政区域データ）」（国土交通省）（${N03_URL}）をもとにひとめぐり作成`,
        note: '區界經過簡化（加工）',
      },
    ],
  },
  {
    id: 'content',
    title: '景點與內容',
    items: [
      {
        name: 'OpenStreetMap',
        href: 'https://www.openstreetmap.org/copyright',
        use: '景點的位置、最寄駅、鐵路路線，老舖・茶屋、角色商店、寶可夢中心的店名與位置',
        license: { label: 'ODbL 1.0', href: 'https://opendatacommons.org/licenses/odbl/' },
        note: '© OpenStreetMap contributors',
      },
      {
        name: 'Wikidata',
        href: 'https://www.wikidata.org/',
        use: '景點、祭典、地區特色、浮世繪作品的基本資料與念法',
        license: CC0,
      },
      {
        name: '維基百科（日文、中文、英文）',
        href: 'https://ja.wikipedia.org/',
        use: '景點、祭典、地區特色的簡介與念法，100名城・続100名城、老舖的一覽',
        license: { label: 'CC BY-SA 4.0', href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hant' },
        note: '簡介下方附條目連結。英文條目譯成中文的簡介，授權同原文',
      },
      {
        name: 'Wikimedia Commons',
        href: 'https://commons.wikimedia.org/',
        use: '景點、祭典、地區特色的照片，浮世繪的圖',
        license: '依各檔案（CC BY-SA、CC BY、公有領域等）',
        note: '作者與授權標在每張照片上，連到檔案頁',
      },
      {
        name: 'Wikimedia 瀏覽量統計',
        href: 'https://www.wikimedia.org/',
        use: '景點、祭典的排列順序（維基百科條目的瀏覽次數）',
      },
      {
        name: '農林水産省「うちの郷土料理」',
        href: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/',
        use: '地區特色的郷土料理名稱、念法與介紹',
        license: '公共データ利用規約（第1.0版）',
        note: '出典：農林水産省',
      },
      {
        name: '気象庁「生物季節観測」',
        href: 'https://www.data.jma.go.jp/sakura/data/index.html',
        use: '期間限定的櫻花、紅葉、銀杏黃葉，深度探索的季節（平年值）',
        license: PDL,
        note: '出典：気象庁',
      },
      {
        name: '各地的官方觀光網站',
        href: 'https://www.gotokyo.org/',
        use: '東京、京都、大阪、北海道、福岡、沖繩的景點挑選（名稱、座標與頁面網址）',
        note: 'GO TOKYO、京都観光Navi、OSAKA-INFO、HOKKAIDO LOVE!、クロスロードふくおか、おきなわ物語。各景點的來源附頁面網址',
      },
      {
        name: 'ポケモンローカルActs',
        href: 'https://local.pokemon.jp/',
        use: 'ポケふた的所在地、寶可夢名稱與頁面網址',
        note: '不使用人孔蓋圖片與介紹文字',
      },
      {
        name: '観光庁「多言語解説文データベース」等',
        href: 'https://www.mlit.go.jp/tagengo-db/',
        use: '旅前準備的會話與用詞（編輯整理，參考來源附在各句）',
      },
    ],
  },
]

const FONTS = 'Noto Sans TC、Noto Sans JP、Barlow Semi Condensed，以及年代主題的字型'

const licenses = (l: Link | string | Array<Link | string>): Array<Link | string> => (Array.isArray(l) ? l : [l])
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 pt-9 pb-24 max-sm:px-4">
    <h1 class="text-h2 font-black tracking-title">資料來源</h1>

    <section v-for="g in GROUPS" :key="g.id" class="flex flex-col gap-1" :aria-labelledby="`credits-${g.id}`">
      <h2 :id="`credits-${g.id}`" class="pb-2 text-h3 font-black tracking-title">{{ g.title }}</h2>
      <dl class="flex flex-col">
        <div v-for="s in g.items" :key="s.name + s.use" class="grid gap-x-6 gap-y-1 border-t border-line-soft py-3.5 sm:grid-cols-[13rem_1fr]">
          <dt class="text-body-sm font-bold">
            <a :href="s.href" target="_blank" rel="noopener" class="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{{ s.name }}</a>
          </dt>
          <dd class="flex flex-col gap-1 text-body-sm">
            <span>{{ s.use }}</span>
            <span v-if="s.license" class="text-caption text-sub">
              授權：<template v-for="(l, i) in licenses(s.license)" :key="i"
                ><template v-if="i">／</template
                ><a v-if="typeof l === 'object'" :href="l.href" target="_blank" rel="noopener" class="text-sub">{{ l.label }}</a
                ><template v-else>{{ l }}</template></template
              >
            </span>
            <span v-if="s.credit" lang="ja" class="text-caption text-sub wrap-anywhere">{{ s.credit }}</span>
            <span v-if="s.note" class="text-caption text-sub">{{ s.note }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="flex flex-col gap-1" aria-labelledby="credits-other">
      <h2 id="credits-other" class="pb-2 text-h3 font-black tracking-title">其他</h2>
      <dl class="flex flex-col">
        <div class="grid gap-x-6 gap-y-1 border-t border-line-soft py-3.5 sm:grid-cols-[13rem_1fr]">
          <dt class="text-body-sm font-bold">直飛航線</dt>
          <dd class="text-body-sm">編輯整理。航班以航空公司公告為準</dd>
        </div>
        <div class="grid gap-x-6 gap-y-1 border-t border-line-soft py-3.5 sm:grid-cols-[13rem_1fr]">
          <dt class="text-body-sm font-bold">
            <a href="https://fonts.google.com/" target="_blank" rel="noopener" class="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">字型（Google Fonts）</a>
          </dt>
          <dd class="flex flex-col gap-1 text-body-sm">
            <span>{{ FONTS }}</span>
            <span class="text-caption text-sub">授權見各字型的頁面</span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="credits-note">
      <h2 id="credits-note" class="text-h3 font-black tracking-title">注意事項</h2>
      <ul class="flex list-disc flex-col gap-1.5 pl-5 text-body-sm leading-relaxed">
        <li>營業時間、票價、交通與活動日期可能變動。出發前請到官方網站確認。</li>
        <li>期間限定的期間依気象庁的觀測日推算，不是官方發表的賞花、賞楓時期。</li>
        <li>照片與簡介的著作權屬於各作者。商品、角色名稱與商標屬於各權利人，本站與各權利人沒有關係。</li>
      </ul>
    </section>
  </section>
</template>
