import { createRouter, createWebHistory } from 'vue-router'

// 探索頁是落地頁：直接打包進主程式，避免主程式跑完才開始下載地圖的串接等待
import ExploreView from '../views/ExploreView.vue'

// 路由表見 UX-FLOW.md §1.1、§5.2。Phase 0 只掛上骨架，畫面內容依後續階段補齊。
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: ExploreView },
    { path: '/explore', name: 'explore', component: ExploreView, meta: { title: '探索' } },
    { path: '/map/:pref', name: 'map', component: ExploreView, props: true, meta: { title: '探索' } },
    {
      path: '/region/:pref',
      name: 'region',
      component: () => import('../views/RegionView.vue'),
      props: true,
      meta: { title: '深度探索' },
    },
    { path: '/trips', name: 'trips', component: () => import('../views/TripsView.vue'), meta: { title: '行程' } },
    {
      path: '/trips/:id',
      name: 'trip',
      component: () => import('../views/TripView.vue'),
      props: true,
      meta: { title: '行程' },
    },
    {
      path: '/trips/:id/prep',
      name: 'prep',
      component: () => import('../views/PrepView.vue'),
      props: true,
      meta: { title: '旅前準備' },
    },
    {
      path: '/trips/:id/prep/practice',
      name: 'practice',
      component: () => import('../views/PracticeView.vue'),
      props: true,
      meta: { title: '練習' },
    },
    {
      path: '/trips/:id/book',
      name: 'book',
      component: () => import('../views/BookView.vue'),
      props: true,
      meta: { title: '旅前小書' },
    },
    { path: '/limited', name: 'limited', component: () => import('../views/LimitedView.vue'), meta: { title: '期間限定' } },
    { path: '/log', name: 'log', component: () => import('../views/LogView.vue'), meta: { title: '紀錄' } },
    { path: '/me', name: 'me', component: () => import('../views/MeView.vue'), meta: { title: '收藏與清單' } },
    {
      path: '/me/lists/:id',
      name: 'list',
      component: () => import('../views/ListView.vue'),
      props: true,
      meta: { title: '清單' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// <title>：「{頁面名稱}｜ひとめぐり」，首頁只寫「ひとめぐり」（DESIGN.md §1b）。
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title}｜ひとめぐり` : 'ひとめぐり'
})
