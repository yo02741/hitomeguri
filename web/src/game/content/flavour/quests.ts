/**
 * 委託的說法（規格 §8.5、§8.7）：話是遊戲寫的，{item}、{town}、{spot}、{thing} 由資料與遊戲填進去
 * （item 是真的地區特色或老舖的東西、town 是鎮名、spot 是景點名、thing 是一般的小東西）。
 * 樣板本身跟其他虛構台詞一樣接受 lint：沒有真實名字、數字、驚嘆號。
 */
export interface QuestLines {
  /** 委託的人開口 */
  ask: string
  /** 答應之後 */
  accept: string
  /** 再去找他、還沒做完 */
  remind: string
  /** 做完了（領旅費之前的那句） */
  done: string
}

export const QUEST_LINES: { deliver: QuestLines; photo: QuestLines; photoNight: QuestLines; lost: QuestLines } = {
  deliver: {
    ask: '可以幫我把這份{item}帶去{town}嗎？到了那邊，跟路上的人說一聲就好。',
    accept: '謝謝，麻煩你了。',
    remind: '{town}的人應該在等{item}了。',
    done: '這是{item}吧。特地送過來，謝謝。',
  },
  photo: {
    ask: '想請你幫我拍一張{spot}的照片。',
    accept: '拍好了再拿來給我看。',
    remind: '{spot}的照片，拍到了嗎？',
    done: '拍得真好，謝謝。',
  },
  photoNight: {
    ask: '想請你幫我拍一張{spot}的夜景。',
    accept: '天黑以後再去拍就好。',
    remind: '{spot}晚上的樣子，拍到了嗎？',
    done: '晚上原來是這個樣子，謝謝。',
  },
  lost: {
    ask: '我的{thing}好像掉在{spot}的告示牌附近，可以幫我找找嗎？',
    accept: '找到的話，拿來給我。',
    remind: '{thing}找到了嗎？',
    done: '就是這個，謝謝你。',
  },
}

/** 其他時候的一句 */
export const QUEST_MISC = {
  /** 領旅費時 */
  reward: '這是一點心意。',
  /** 拒絕了 */
  decline: '那下次吧。',
  /** 手上的委託太多 */
  busy: '你手上的事好像很多，下次吧。',
  /** 今天的委託已經做完 */
  rest: '今天的事都辦好了，謝謝你。',
  /** 在委託的那一鎮，路上的人收下東西 */
  receive: '是要給我的嗎？',
  /** 在告示牌旁邊找到東西（旁白） */
  found: '告示牌旁邊有一個{thing}。',
  /** 答應或拒絕 */
  yes: '好',
  no: '下次吧',
  /** 還沒做完、再去找他：繼續（找東西／拍照／送東西各一句）或不做了 */
  keep: '再找找看',
  keepPhoto: '再去拍',
  keepDeliver: '這就送去',
  quit: '不做了',
  /** 不做了 */
  quitDone: '這樣啊，沒關係。',
}
