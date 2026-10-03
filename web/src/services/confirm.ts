import { shallowRef } from 'vue'

/**
 * 站內確認框（ConfirmDialog.vue，DESIGN.md §7.26）：取代 window.confirm，用在不能復原的動作
 * （刪除行程、清單、截圖，移出成員、離開共編、重新產生邀請連結）。手機的 window.confirm 會顯示網域，
 * 樣式也和站內不一致。一次只開一個；又開一個時前一個當作取消。
 */
export interface ConfirmOptions {
  /** 問句，例：刪除清單「京都」？ */
  title: string
  /** 補充後果，例：清單裡景點的收藏與去過不受影響。 */
  body?: string
  /** 確定鈕的字，例：刪除 */
  ok: string
  /** 確定鈕用 danger 色 */
  danger?: boolean
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number
  resolve: (ok: boolean) => void
}

export const confirmRequest = shallowRef<ConfirmRequest | null>(null)
let seq = 0

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  confirmRequest.value?.resolve(false)
  return new Promise((resolve) => {
    const id = ++seq
    confirmRequest.value = {
      ...opts,
      id,
      resolve: (ok) => {
        if (confirmRequest.value?.id === id) confirmRequest.value = null
        resolve(ok)
      },
    }
  })
}
