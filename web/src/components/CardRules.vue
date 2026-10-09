<script setup lang="ts">
import NewTag from './NewTag.vue'
import RulesDialog from './RulesDialog.vue'
import TicketTable from './TicketTable.vue'

// 收集冊的規則（DESIGN.md §7.19a、§7.19b）：收集冊「規則」打開的說明書。寫事實、條列，附上自己現在的抽獎券明細。
const emit = defineEmits<{ close: [] }>()

const KINDS: Array<[string, string]> = [
  ['基本', '去過就有'],
  ['春景・夏景・秋景・冬景', '去的那天是哪一季就有那一季；也抽得到'],
  ['全景', '照片鋪滿整張卡'],
  ['夜景', '夜晚的照片；找得到夜景照片的景點才有'],
  ['墨繪', '照片變水墨，和紙卡面'],
  ['切手', '郵票：齒孔、消印'],
  ['銀箔・金箔', '整張銀框、金框'],
  ['特別全景', '世界遺產、國寶、特別史跡、特別名勝才有'],
]
</script>

<template>
  <RulesDialog title="收集冊的規則" @close="emit('close')">
    <section class="flex flex-col gap-2" aria-labelledby="c-card">
      <h3 id="c-card" class="text-body-sm font-bold text-sub">卡片</h3>
      <ul class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li>去過的景點就有一張卡。</li>
        <li>去的日期決定季節卡：3–5 月春、6–8 月夏、9–11 月秋、12–2 月冬。不同季節去，季節卡就不只一張。</li>
        <li>卡號是縣內依知名度的順序；名城用名城的番號。</li>
        <li>右上的標示：世界遺產、國寶、特別史跡、特別名勝、100名城・続100名城。</li>
      </ul>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="c-kind">
      <h3 id="c-kind" class="text-body-sm font-bold text-sub">樣式</h3>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body-sm">
        <template v-for="[k, d] in KINDS" :key="k">
          <dt class="font-bold whitespace-nowrap">{{ k }}</dt>
          <dd>{{ d }}</dd>
        </template>
      </dl>
      <p class="text-caption text-sub">每個景點 10 種；有夜景照片的多夜景，世界遺產、國寶、特別史跡、特別名勝多特別全景。</p>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="c-draw">
      <h3 id="c-draw" class="text-body-sm font-bold text-sub">抽卡</h3>
      <ul class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li>每個景點第一次去過，送一次免費抽（在景點按「去過」，或打開行程的卡包；只送一次）。</li>
        <li>放大檢視的「抽一張」：用 1 張抽獎券，抽這個景點。</li>
        <li>上方的「十連抽」：用 10 張，從還沒收齊的景點裡抽 10 種。不用一直去同一個地方。</li>
        <li>只會抽到還沒有的樣式。稀有的比較晚出來，抽到最後一定都會有；收齊了按鈕寫「已收齊」。</li>
      </ul>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="c-ticket">
      <h3 id="c-ticket" class="text-body-sm font-bold text-sub">抽獎券（與旅人共用）</h3>
      <ul class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li>張數由去過的地方算出來：取消去過、再勾回來不會變多。</li>
      </ul>
      <TicketTable />
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="c-book">
      <h3 id="c-book" class="text-body-sm font-bold text-sub">收集冊</h3>
      <dl class="grid grid-cols-[3rem_1fr] items-center gap-x-3 gap-y-2 text-body-sm">
        <dt class="font-num text-caption text-sub">3 / 10</dt>
        <dd>這個景點收集到幾種</dd>
        <dt><NewTag /></dt>
        <dd>新拿到、還沒看過的樣式</dd>
        <dt class="text-caption font-bold text-sub">封面</dt>
        <dd>放大檢視收集到兩種以上時，可以「設為收集冊的封面」；沒選就是基本卡</dd>
      </dl>
    </section>
  </RulesDialog>
</template>
