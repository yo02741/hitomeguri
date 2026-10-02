<script setup lang="ts">
import { OUTFITS } from '../data/outfits'
import { useAvatarStore } from '../stores/avatar'
import NewTag from './NewTag.vue'
import RulesDialog from './RulesDialog.vue'
import TicketTable from './TicketTable.vue'

// 旅人的規則（DESIGN.md §7.24）：標題旁「規則」打開的說明書。寫事實、條列，附上自己現在的抽獎券明細。
const emit = defineEmits<{ close: [] }>()
const avatar = useAvatarStore()
const generic = OUTFITS.filter((o) => !o.pref).length
const prefCount = OUTFITS.filter((o) => o.pref).length
</script>

<template>
  <RulesDialog title="旅人的規則" @close="emit('close')">
    <section class="flex flex-col gap-2" aria-labelledby="r-outfit">
      <h3 id="r-outfit" class="text-label font-bold text-sub">服裝</h3>
      <ul class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li>每個縣有 3 件，共 <span class="font-latin">{{ prefCount }}</span> 件；另外不限縣的 <span class="font-latin">{{ generic }}</span> 件。</li>
        <li>第一次去一個縣，送那個縣的代表單品。</li>
        <li>去過的縣的另外兩件，和不限縣的，用扭蛋抽。</li>
        <li>扭蛋只會抽到還沒有的。去過的縣都抽齊了，去新的縣就會加進新的。</li>
      </ul>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="r-ticket">
      <h3 id="r-ticket" class="text-label font-bold text-sub">抽獎券（與收集卡共用）</h3>
      <ul class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li>抽一次扭蛋、抽一張卡都用 1 張；十連抽用 10 張。</li>
        <li>張數由去過的地方算出來：取消去過、再勾回來不會變多。</li>
      </ul>
      <TicketTable />
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="r-mark">
      <h3 id="r-mark" class="text-label font-bold text-sub">衣櫃的記號</h3>
      <dl class="grid grid-cols-[2.25rem_1fr] items-center gap-x-3 gap-y-2 text-body-sm">
        <dt class="grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 120 120" aria-label="小扭蛋"><path d="M14 60 A46 46 0 0 1 106 60Z" class="ball-top" /><path d="M14 60 A46 46 0 0 0 106 60Z" class="ball-bottom" /></svg>
        </dt>
        <dd>扭蛋抽得到、還沒抽到</dd>
        <dt class="grid place-items-center"><span class="pref-tag rounded-tag px-1.5 text-[10px] leading-[16px] font-bold">縣名</span></dt>
        <dd>那個縣的單品；剪影的是還沒去過、還沒拿到</dd>
        <dt class="grid place-items-center"><span class="seal grid size-6 place-items-center rounded-full text-[11px] font-black">穿</span></dt>
        <dd>正在穿</dd>
        <dt class="grid place-items-center"><NewTag /></dt>
        <dd>新拿到、還沒點過</dd>
      </dl>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="r-stage">
      <h3 id="r-stage" class="text-label font-bold text-sub">展示窗</h3>
      <ul class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li>左右拖拉可以轉，看得到紙的背面；雙擊轉回正面。</li>
        <li>穿上的會跟著在網站下方散步（帳號選單可以關）。</li>
      </ul>
    </section>

    <p class="text-caption text-sub">服裝 <span class="font-latin font-bold text-ink">{{ avatar.ownedIds.size }}</span> / {{ OUTFITS.length }}</p>
  </RulesDialog>
</template>

<style scoped>
.ball-top {
  fill: var(--color-paper);
  stroke: var(--color-line);
  stroke-width: 8;
}
.ball-bottom {
  fill: var(--color-item-red);
}
.pref-tag {
  background: var(--region-strong);
  color: var(--color-white);
}
.seal {
  background: var(--color-item-red);
  color: var(--color-item-white);
  rotate: -10deg;
}
</style>
