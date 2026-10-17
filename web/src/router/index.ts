import { createRouter, createWebHistory } from 'vue-router'

// 探索頁是落地頁：直接打包進主程式，避免主程式跑完才開始下載地圖的串接等待
import ExploreView from '../views/ExploreView.vue'

// 路由表見 UX-FLOW.md §1.1、§5.2。Phase 0 只掛上骨架，畫面內容依後續階段補齊。
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // bleed：地圖鋪到橫向瀏海底下（App.vue、theme.css 的 .map-root）
    { path: '/', name: 'home', component: ExploreView, meta: { bleed: true } },
    { path: '/explore', name: 'explore', component: ExploreView, meta: { title: '探索', bleed: true } },
    { path: '/map/:pref', name: 'map', component: ExploreView, props: true, meta: { title: '探索', bleed: true } },
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
    { path: '/join/:code', name: 'join', component: () => import('../views/JoinView.vue'), props: true, meta: { title: '共編行程' } },
    { path: '/limited', name: 'limited', component: () => import('../views/LimitedView.vue'), meta: { title: '期間限定' } },
    { path: '/log', name: 'log', component: () => import('../views/LogView.vue'), meta: { title: '紀錄' } },
    { path: '/log/cards', name: 'cards', component: () => import('../views/CardsView.vue'), meta: { title: '收集冊' } },
    { path: '/log/cards/ukiyoe', name: 'ukiyoe', component: () => import('../views/UkiyoeView.vue'), meta: { title: '浮世繪裡的景點' } },
    { path: '/log/keiken', name: 'keiken', component: () => import('../views/KeikenView.vue'), meta: { title: '經縣值' } },
    { path: '/log/avatar', name: 'avatar', component: () => import('../views/AvatarView.vue'), meta: { title: '旅人' } },
    // 3D 旅人試作（DESIGN.md §7.24a）：還沒接到旅人頁
    { path: '/log/avatar/3d', name: 'avatar-3d', component: () => import('../views/Avatar3DView.vue'), meta: { title: '旅人 3D' } },
    { path: '/log/achievements', name: 'achievements', component: () => import('../views/AchievementsView.vue'), meta: { title: '成就' } },
    { path: '/me', name: 'me', component: () => import('../views/MeView.vue'), meta: { title: '收藏與清單' } },
    {
      path: '/me/lists/:id',
      name: 'list',
      component: () => import('../views/ListView.vue'),
      props: true,
      meta: { title: '清單' },
    },
    { path: '/credits', name: 'credits', component: () => import('../views/CreditsView.vue'), meta: { title: '資料來源' } },
    // 形象網站：不顯示 app 的標頭與分頁列（App.vue 的 meta.bare）
    { path: '/about', name: 'about', component: () => import('../views/AboutView.vue'), meta: { title: '關於', bare: true } },
    // 番外篇（像素遊戲）：整頁是遊戲，同樣不放標頭與分頁列。
    // beforeEnter：遊戲的資料先開始抓（不等遊戲的程式下載完）；旅人的 avatar store 在元件外建（在 PlayView 的 setup 裡
    // 第一次建的話，store 的 watch 會一直抓著那一頁，離開後整個遊戲放不掉）
    {
      path: '/play',
      name: 'play',
      component: () => import('../views/PlayView.vue'),
      meta: { title: '番外篇', bare: true, ownSafeArea: true },
      beforeEnter: async () => {
        void import('../services/playPrefetch').then((m) => m.prefetchPlay())
        const { useAvatarStore } = await import('../stores/avatar')
        useAvatarStore()
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// <title>：「{頁面名稱}｜ひとめぐり」，首頁只寫「ひとめぐり」（DESIGN.md §1b）。
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title}｜ひとめぐり` : 'ひとめぐり'
})
