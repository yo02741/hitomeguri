import { createRouter, createWebHistory } from 'vue-router'

// 路由表見 UX-FLOW.md §1.1、§5.2。Phase 0 只掛上骨架，畫面內容依後續階段補齊。
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/ExploreView.vue') },
    { path: '/explore', name: 'explore', component: () => import('../views/ExploreView.vue'), meta: { title: '探索' } },
    { path: '/map/:pref', name: 'map', component: () => import('../views/ExploreView.vue'), props: true, meta: { title: '探索' } },
    { path: '/trips', name: 'trips', component: () => import('../views/TripsView.vue'), meta: { title: '行程' } },
    { path: '/log', name: 'log', component: () => import('../views/LogView.vue'), meta: { title: '紀錄' } },
    { path: '/me', name: 'me', component: () => import('../views/MeView.vue'), meta: { title: '我的' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// <title>：「{頁面名稱}｜ひとめぐり」，首頁只寫「ひとめぐり」（DESIGN.md §1b）。
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title}｜ひとめぐり` : 'ひとめぐり'
})
