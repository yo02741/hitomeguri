import { createRouter, createWebHistory } from 'vue-router'

// 路由表見 UX-FLOW.md §1.1、§5.2。Phase 0 只掛上骨架，畫面內容依後續階段補齊。
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/ExploreView.vue') },
    { path: '/explore', name: 'explore', component: () => import('../views/ExploreView.vue') },
    { path: '/map/:pref', name: 'map', component: () => import('../views/ExploreView.vue'), props: true },
    { path: '/trips', name: 'trips', component: () => import('../views/TripsView.vue') },
    { path: '/log', name: 'log', component: () => import('../views/LogView.vue') },
    { path: '/me', name: 'me', component: () => import('../views/MeView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
