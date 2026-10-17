import { type FlavourLine, lines } from './types'

/**
 * 關東（東京）的台詞：上班、上學、電車、大樓、柏油路的熱、乾冷的冬天（偶爾下雪，不積）。
 * 路人多是上班的人與學生。不寫任何真實的名字，也不講資料沒有的事：
 * 大樓、高架、紅綠燈只在街上說（setting urban：區的街上才畫）；郊外（八王子這類的市）講田邊、山、安靜的月台。
 */
const RURAL = ['rural'] as const
const URBAN = ['urban'] as const

export const KANTO: FlavourLine[] = [
  ...lines('passer', 'kanto', 'day', [
    '電車又擠又悶，好不容易才擠下車。',
    '午休只有一下子，得趕快吃完。',
    '每天早上都在同一家店買一杯咖啡。',
    '下課了，大家都往車站的方向走。',
    '公事包好重，裡面塞滿了資料。',
    '轉車的通道好長，走得腿都痠了。',
    '站在自動販賣機前面，又在猶豫要喝什麼。',
    '制服的領帶，總是打不正。',
    '社團練習到很晚，肚子好餓。',
    '每天都從同一扇門上車。',
    '午休的時候，公園的長椅都坐滿了。',
  ]),
  ...lines('passer', 'kanto', 'city', ['這一帶的大樓，從下面看不到頂。', '路口的紅綠燈，好像怎麼等都等不到。', '人行道上的人，每個都走得好快。', '高架上的電車，一班接著一班開過去。'], { setting: URBAN }),
  ...lines('passer', 'kanto', 'suburb', ['這一帶的路比較窄，車子開得很慢。', '田邊的小路，走起來好安靜。', '電車一離開，月台又安靜下來了。', '遠處的山，今天看得很清楚。'], { setting: RURAL }),
  ...lines('passer', 'kanto', 'spring', ['公司的新人，看起來都還很緊張。', '開學了，車上多了好多新制服。', '眼睛好癢，這陣子出門都要戴口罩。', '外套終於可以收起來了。'], { season: ['spring'] }),
  // 講開花、黃葉的：平年值算出來開著才說
  ...lines('passer', 'kanto', 'sakura', ['公園的樹下鋪滿了野餐墊。', '下班之後，去樹下走一走再回家。'], { bloom: ['sakura'] }),
  ...lines('passer', 'kanto', 'ichou', ['路上都是黃色的葉子，踩起來沙沙響。', '行道樹一夜之間全黃了。'], { bloom: ['ichou'] }),
  ...lines('passer', 'kanto', 'summer', ['從冷氣房走出來，眼鏡一下子起霧。', '柏油路曬得好燙，鞋底都熱了。', '晚上的電車也還是好熱。', '一整天都在找有冷氣的地方。'], { season: ['summer'] }),
  ...lines('passer', 'kanto', 'summer-city', ['大樓之間吹來的風，一點也不涼。', '蟬的聲音，連大樓之間都聽得到。'], { season: ['summer'], setting: URBAN }),
  ...lines('passer', 'kanto', 'summer-suburb', ['蟬叫得好大聲，樹蔭下也好熱。'], { season: ['summer'], setting: RURAL }),
  ...lines('passer', 'kanto', 'autumn', ['天氣終於舒服了，走路剛剛好。', '颱風走了，空氣變得好乾淨。', '早晚涼了，要多帶一件外套。'], { season: ['autumn'] }),
  ...lines('passer', 'kanto', 'autumn-city', ['傍晚的天空，把大樓的玻璃都染成橘色。'], { season: ['autumn'], setting: URBAN }),
  ...lines('passer', 'kanto', 'winter', ['天氣好乾，嘴唇都裂了。', '冬天的天空，藍得好清楚。', '車廂裡的暖氣太強，又熱又悶。', '早上的月台，大家都縮著脖子。'], { season: ['winter'] }),
  ...lines('passer', 'kanto', 'winter-city', ['大樓之間的風，冷得刺骨。'], { season: ['winter'], setting: URBAN }),
  ...lines('passer', 'kanto', 'night', ['末班車前，月台擠滿了人。'], { time: ['night'] }),
  ...lines('passer', 'kanto', 'night-city', ['加班到現在，車站還是好多人。', '大樓的窗戶，一格一格都還亮著。', '高架下面，只聽得到自己的腳步聲。'], { time: ['night'], setting: URBAN }),
  ...lines('passer', 'kanto', 'night-suburb', ['晚上好安靜，只有電車的聲音偶爾傳過來。', '路燈隔好遠才有一盞。'], { time: ['night'], setting: RURAL }),
  ...lines('passer', 'kanto', 'rain', ['雨傘又忘在電車上了。', '車站的出口擠滿了等雨停的人。', '下雨天，車廂的地板濕濕滑滑的。'], { weather: ['rain'] }),
  ...lines('passer', 'kanto', 'snow', ['難得下雪，電車都慢了。', '雪下得不大，一落地就化了。', '大家走路都小心翼翼的。'], { weather: ['snow'] }),

  // 茶屋
  ...lines('teahouse', 'kanto', 'sit', ['坐下來，外面的聲音一下子變遠了。', '杯子小小的，茶一下就喝完了。', '窗邊的位子，看得到路上走來走去的人。', '休息一下，再去趕下一班車。', '茶的熱氣，慢慢往上飄。']),
]
