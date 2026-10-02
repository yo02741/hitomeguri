<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { OUTFITS } from '../data/outfits'
import { useAvatarStore } from '../stores/avatar'
import { TICKET_RULES, useWalletStore } from '../stores/wallet'
import NewTag from './NewTag.vue'

// 旅人的規則（DESIGN.md §7.24）：標題旁「規則」打開的說明書。使用者自己打開才出現，不是 onboarding。
// 寫事實、條列，附上自己現在的抽獎券明細。Esc、點外面、「關閉」收起。
const emit = defineEmits<{ close: [] }>()
const avatar = useAvatarStore()
const wallet = useWalletStore()
const generic = OUTFITS.filter((o) => !o.pref).length
const prefCount = OUTFITS.filter((o) => o.pref).length

const closeBtn = ref<HTMLButtonElement | null>(null)
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  closeBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 z-[70] grid place-items-center bg-ink/60 p-4" @click.self="emit('close')">
    <section class="rules scroll-quiet flex max-h-full w-full max-w-[520px] flex-col gap-5 overflow-y-auto rounded-card bg-paper p-6 text-ink shadow-float max-sm:p-5" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <header class="flex items-center">
        <h2 id="rules-title" class="text-h3 font-black tracking-[2px]">旅人的規則</h2>
        <button ref="closeBtn" type="button" class="ml-auto h-9 rounded-control px-3 text-label font-bold text-sub hover:bg-surface hover:text-ink" @click="emit('close')">關閉</button>
      </header>

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
        <table class="w-full text-body-sm">
          <thead class="sr-only"><tr><th>來源</th><th>每個</th><th>你的</th></tr></thead>
          <tbody class="font-latin">
            <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">去過的景點</td><td class="text-sub">× {{ TICKET_RULES.spot }}</td><td class="text-right">{{ wallet.breakdown.spots * TICKET_RULES.spot }}</td></tr>
            <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">去過的縣</td><td class="text-sub">× {{ TICKET_RULES.pref }}</td><td class="text-right">{{ wallet.breakdown.prefs * TICKET_RULES.pref }}</td></tr>
            <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">去過的地方（北海道、東北…）</td><td class="text-sub">× {{ TICKET_RULES.area }}</td><td class="text-right">{{ wallet.breakdown.areas * TICKET_RULES.area }}</td></tr>
            <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">景點每 10 個</td><td class="text-sub">× {{ TICKET_RULES.every10 }}</td><td class="text-right">{{ wallet.breakdown.bonus * TICKET_RULES.every10 }}</td></tr>
            <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">用掉</td><td></td><td class="text-right">− {{ wallet.used }}</td></tr>
            <tr><td class="py-1.5 font-sans font-bold">剩下</td><td></td><td class="text-right text-body font-bold">{{ wallet.left }}</td></tr>
          </tbody>
        </table>
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
    </section>
  </div>
</template>

<style scoped>
.rules {
  animation: rules-in 0.2s var(--ease-out-soft) both;
}
@keyframes rules-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
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
@media (prefers-reduced-motion: reduce) {
  .rules {
    animation: none;
  }
}
</style>
