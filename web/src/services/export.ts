import type { MarkedSpot } from '../composables/markedSpots'
import { prefectureFullName } from '../data/regions'
import { googleMapsUrl } from './maps'

// 收藏、清單、去過、行程的匯出（PLAN.md §8）。在瀏覽器裡產生檔案下載，不經過伺服器。
// KML 可匯入 Google My Maps：https://developers.google.com/kml/documentation/kmlreference

export interface ExportRow {
  name: string
  pref: string
  kana?: string
  zh?: string
  romaji?: string
  lat?: number
  lng?: number
  /** CSV 額外欄位（欄名 → 值）；KML 的說明也會列出 */
  extra?: Record<string, string>
}

export interface ExportFolder {
  name: string
  rows: ExportRow[]
}

function xml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)
}

/** KML：地點名稱用日文，說明放假名、中文名、額外欄位與 Google Maps 連結；沒有座標的略過 */
export function toKml(title: string, folders: ExportFolder[]): string {
  const body = folders
    .map((f) => {
      const marks = f.rows
        .filter((r) => r.lat !== undefined && r.lng !== undefined)
        .map((r) => {
          const extra = Object.entries(r.extra ?? {})
            .filter(([, v]) => v)
            .map(([k, v]) => `${k} ${v}`)
          const desc = [r.kana, r.zh, ...extra, googleMapsUrl(r.name, r.pref)].filter(Boolean).join('\n')
          return [
            '      <Placemark>',
            `        <name>${xml(r.name)}</name>`,
            `        <description>${xml(desc)}</description>`,
            `        <Point><coordinates>${r.lng},${r.lat},0</coordinates></Point>`,
            '      </Placemark>',
          ].join('\n')
        })
      if (!marks.length) return ''
      return `    <Folder>\n      <name>${xml(f.name)}</name>\n${marks.join('\n')}\n    </Folder>`
    })
    .filter(Boolean)
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    `    <name>${xml(title)}</name>`,
    body,
    '  </Document>',
    '</kml>',
    '',
  ].join('\n')
}

/** 依縣分 folder（JIS 順由呼叫端排好） */
export function foldersByPref(rows: ExportRow[]): ExportFolder[] {
  const out = new Map<string, ExportRow[]>()
  for (const r of rows) out.set(r.pref, [...(out.get(r.pref) ?? []), r])
  return [...out.entries()].map(([pref, rs]) => ({ name: prefectureFullName(pref), rows: rs }))
}

function csvCell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV（UTF-8 BOM，Excel 直接開不會亂碼）；leading 是放在最前面的額外欄位（例：行程的日、順序） */
export function toCsv(rows: ExportRow[], leading: string[] = []): string {
  const trailing = [...new Set(rows.flatMap((r) => Object.keys(r.extra ?? {})))].filter((k) => !leading.includes(k))
  const head = [...leading, '名稱', '假名', '中文名', '羅馬拼音', '都道府縣', '緯度', '經度', 'Google Maps', ...trailing]
  const lines = rows.map((r) =>
    [
      ...leading.map((k) => r.extra?.[k]),
      r.name,
      r.kana,
      r.zh,
      r.romaji,
      prefectureFullName(r.pref),
      r.lat,
      r.lng,
      googleMapsUrl(r.name, r.pref),
      ...trailing.map((k) => r.extra?.[k]),
    ]
      .map(csvCell)
      .join(','),
  )
  return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n'
}

/** 收藏、清單、去過的一筆 */
export function markRow(r: MarkedSpot): ExportRow {
  return {
    ...r,
    extra: { 收藏: r.mark.favorite ? '是' : '', 去過: r.mark.visited ? '是' : '', 去過日期: r.mark.visited_on ?? '' },
  }
}

/** 檔名不能有的字元換成底線 */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'hitomeguri'
}

const MIME = { kml: 'application/vnd.google-earth.kml+xml', csv: 'text/csv' } as const

function saveFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 下載檔案（桌機） */
export function download(name: string, ext: 'kml' | 'csv', content: string) {
  saveFile(new File([content], `${safeName(name)}.${ext}`, { type: MIME[ext] }))
}

/**
 * 手機的匯出（決定事項 P2）：瀏覽器說能分享這個檔案（navigator.canShare({ files })）就開系統分享，否則下載。
 * 能分享的檔案類型由瀏覽器決定（Chrome 的清單有 CSV、沒有 KML），所以每次都用 canShare 判斷，不自己列。
 * share() 要在點擊的同一個事件裡呼叫（transient activation），前面不能先 await。
 * 使用者取消（AbortError）就結束；其他錯誤（NotAllowedError…）改成下載。
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
 */
export async function shareOrDownload(name: string, ext: 'kml' | 'csv', content: string): Promise<void> {
  const file = new File([content], `${safeName(name)}.${ext}`, { type: MIME[ext] })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as DOMException | null)?.name === 'AbortError') return
    }
  }
  saveFile(file)
}
