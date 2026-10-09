// 成就服裝（DESIGN.md §7.24、§7.25）：這些成就達成就送 1 件。
// 由 outfitGifts.test.ts 從 outfitsAchv.ts 產生（`npx vitest run -u`），不要手改。
// 成就頁與成就的 store 只要 id 與名稱，不必為此載入全部服裝的 SVG。
export const ACHV_OUTFIT: Readonly<Record<string, { id: string; name: string }>> = {
  'prefs-47': { id: 'achv-kappa', name: '道中合羽' },
  'castle100-50': { id: 'achv-jingasa', name: '陣笠' },
  'seasons-4': { id: 'achv-shiki-sensu', name: '四季扇子' },
  'trip-7days': { id: 'achv-furoshiki', name: '唐草風呂敷' },
  'spots-300': { id: 'achv-kongozue', name: '金剛杖' },
  'trips-10': { id: 'achv-kaeru', name: '無事蛙' },
}
