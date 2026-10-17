<script setup lang="ts">
import { type Wallet, yenText } from '../../../game/systems/wallet'

// 手帳「行李」最上面的旅費（P4，円）：現金、刷卡累計（刷卡沒有額度上限，只記累計）。
// BagPage 用：<WalletLine :wallet="data.wallet" />（data.wallet 是 systems 的 bagPage 給的；沒有時用 money 當現金）
defineProps<{ wallet: Wallet }>()
</script>

<template>
  <dl class="nb-dl wallet">
    <dt>現金</dt>
    <dd>{{ yenText(wallet.cash) }}</dd>
    <dt>刷卡</dt>
    <dd>{{ yenText(wallet.card) }}</dd>
  </dl>
</template>
