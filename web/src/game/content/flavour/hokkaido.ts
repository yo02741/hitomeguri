import { type FlavourLine, lines } from './types'

/**
 * 北海道的台詞：直直的路、一大片的田、牧場、遊客、短的夏天、長的冬天與厚雪。
 * 郊外（setting rural）的路人多是種田、養牛的人與觀光客；街上（札幌的區、函館、小樽這類有鐵路的市）講車站前、店、下班。
 * 不寫任何真實的名字，也不講資料沒有的事：田、牛、拖拉機、矢羽根只在郊外說（街上的地圖沒有畫）；
 * 雪、天黑得早、暖爐只在冬天說。
 */
const RURAL = ['rural'] as const
const URBAN = ['urban'] as const

export const HOKKAIDO: FlavourLine[] = [
  ...lines('passer', 'hokkaido', 'day', ['天空好大，雲走得好快。', '旅行的人都在路邊停下來拍照。', '空氣好乾淨，連遠山都看得清清楚楚。']),
  ...lines(
    'passer',
    'hokkaido',
    'farm',
    [
      '這裡的路好直，一直走都看不到盡頭。',
      '田一大片一大片的，看不到邊。',
      '牛的叫聲，從很遠的地方傳過來。',
      '下一個村子，還要走好一段路。',
      '照片拍了好多張，每一張裡面都是地平線。',
      '拖拉機慢慢開過去，後面跟著一串車。',
      '早上先去餵牛，回來才吃早飯。',
      '這邊的房子，屋頂都是彩色的。',
      '路邊那些紅白的箭頭，冬天才派得上用場。',
    ],
    { setting: RURAL },
  ),
  ...lines('passer', 'hokkaido', 'city', ['站前的路上，車子一台接一台。', '買完東西，提著袋子慢慢走回家。', '街角的店，總是有人進進出出。', '下班的時間，路上一下子熱鬧起來。'], { setting: URBAN }),
  ...lines('passer', 'hokkaido', 'spring', ['雪終於化了，路邊都是泥。', '早晚還是好冷，手套收不起來。', '春天來得晚，大家都等好久了。'], { season: ['spring'] }),
  ...lines('passer', 'hokkaido', 'spring-farm', ['田裡開始忙了，一天都不得閒。'], { season: ['spring'], setting: RURAL }),
  ...lines('passer', 'hokkaido', 'sakura', ['櫻花開得晚，一開就跟別的花擠在一起開。'], { bloom: ['sakura'] }),
  ...lines('passer', 'hokkaido', 'summer', ['夏天很短，大家都抓緊時間出門。', '早上涼涼的，中午才熱起來。', '晚上不開冷氣也睡得著。', '白天好長，天黑得好晚。'], { season: ['summer'] }),
  ...lines('passer', 'hokkaido', 'summer-farm', ['麥子黃了，快要收了。'], { season: ['summer'], setting: RURAL }),
  ...lines('passer', 'hokkaido', 'autumn', ['早上起來，車窗上結了一層霜。', '風一天比一天冷。', '遠山的頂上，已經白了。'], { season: ['autumn'] }),
  ...lines('passer', 'hokkaido', 'autumn-farm', ['收成的季節，田裡天天都有人。'], { season: ['autumn'], setting: RURAL }),
  ...lines('passer', 'hokkaido', 'leaves', ['山上的葉子，一下子就紅透了。'], { bloom: ['kaede'] }),
  ...lines(
    'passer',
    'hokkaido',
    'winter',
    ['早上要先剷雪，才能出門。', '路面結冰了，走路要像企鵝一樣。', '吐出來的氣都是白的。', '屋簷的冰柱，比手臂還長。', '雪地好亮，眼睛都睜不開。', '手套脫下來一下，手指就凍僵了。', '踩在雪上，會發出咯吱咯吱的聲音。'],
    { season: ['winter'] },
  ),
  ...lines('passer', 'hokkaido', 'night', ['夜裡的氣溫一下子就降下來。'], { time: ['night'] }),
  ...lines('passer', 'hokkaido', 'night-farm', ['晚上好安靜，只聽得到風聲。', '星星多到數不完。', '遠處的燈，只有零零星星幾盞。'], { time: ['night'], setting: RURAL }),
  ...lines('passer', 'hokkaido', 'night-city', ['晚上的路上，還有人慢慢走著回家。', '店都關了，只剩路燈亮著。'], { time: ['night'], setting: URBAN }),
  ...lines('passer', 'hokkaido', 'rain', ['雨下得涼涼的，外套要穿好。'], { weather: ['rain'] }),
  ...lines('passer', 'hokkaido', 'rain-farm', ['下雨天，田裡的人都休息了。'], { weather: ['rain'], setting: RURAL }),
  ...lines('passer', 'hokkaido', 'snow', ['雪下得好大，前面的路都看不清楚。', '路邊的雪堆比人還高。', '剷雪剷到腰都痠了。', '新下的雪，踩起來軟綿綿的。'], { weather: ['snow'] }),

  // 茶屋：雪、天黑得早只在冬天；暖爐在秋冬
  ...lines('teahouse', 'hokkaido', 'sit', ['熱茶喝下去，整個人都暖了。', '杯子捧在手裡，捨不得放下。']),
  ...lines('teahouse', 'hokkaido', 'sit-warm', ['窗開著，外面的風涼涼的吹進來。', '茶涼一點再喝，剛剛好。', '外面的光好亮，屋裡顯得暗暗的。'], { season: ['spring', 'summer'] }),
  ...lines('teahouse', 'hokkaido', 'sit-stove', ['暖爐旁邊的位子最搶手。'], { season: ['autumn', 'winter'] }),
  ...lines('teahouse', 'hokkaido', 'sit-snow', ['窗外一片白，看著看著就發起呆。', '坐一下就好，天黑得早。'], { season: ['winter'] }),
]
