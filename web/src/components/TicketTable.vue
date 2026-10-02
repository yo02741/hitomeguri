<script setup lang="ts">
import { TICKET_RULES, useWalletStore } from '../stores/wallet'

// 抽獎券的來源與自己目前的張數（DESIGN.md §7.19b）：旅人與收集冊的規則共用
const wallet = useWalletStore()
</script>

<template>
  <table class="w-full text-body-sm">
    <thead class="sr-only"><tr><th>來源</th><th>每個</th><th>你的</th></tr></thead>
    <tbody class="font-latin">
      <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">去過的景點</td><td class="text-sub">× {{ TICKET_RULES.spot }}</td><td class="text-right">{{ wallet.breakdown.spots * TICKET_RULES.spot }}</td></tr>
      <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">去過的縣</td><td class="text-sub">× {{ TICKET_RULES.pref }}</td><td class="text-right">{{ wallet.breakdown.prefs * TICKET_RULES.pref }}</td></tr>
      <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">去過的地方（北海道、東北…）</td><td class="text-sub">× {{ TICKET_RULES.area }}</td><td class="text-right">{{ wallet.breakdown.areas * TICKET_RULES.area }}</td></tr>
      <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">景點每 10 個</td><td class="text-sub">× {{ TICKET_RULES.every10 }}</td><td class="text-right">{{ wallet.breakdown.bonus * TICKET_RULES.every10 }}</td></tr>
      <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">成就（地方、旅行、時節）</td><td class="text-sub">× {{ TICKET_RULES.achv }}</td><td class="text-right">{{ wallet.breakdown.achv * TICKET_RULES.achv }}</td></tr>
      <tr class="border-b border-line-soft"><td class="py-1.5 font-sans">用掉</td><td></td><td class="text-right">− {{ wallet.used }}</td></tr>
      <tr><td class="py-1.5 font-sans font-bold">剩下</td><td></td><td class="text-right text-body font-bold">{{ wallet.left }}</td></tr>
    </tbody>
  </table>
</template>
