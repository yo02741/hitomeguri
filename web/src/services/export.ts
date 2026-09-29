import type { MarkedSpot } from '../composables/markedSpots'
import { prefectureFullName } from '../data/regions'
import { googleMapsUrl } from './maps'

// 收藏、清單、去過的匯出（PLAN.md §8）。在瀏覽器裡產生檔案下載，不經過伺服器。
// KML 可匯入 Google My Maps：https://developers.google.com/kml/documentation/kmlreference

function xml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)
}

/** KML：每個縣一個 folder，地點名稱用日文，說明放假名、中文名與 Google Maps 連結 */
export function toKml(title: string, rows: MarkedSpot[]): string {
  const folders = new Map<string, MarkedSpot[]>()
  for (const r of rows) {
    if (r.lat === undefined || r.lng === undefined) continue
    folders.set(r.pref, [...(folders.get(r.pref) ?? []), r])
  }
  const body = [...folders.entries()]
    .map(([pref, items]) => {
      const marks = items
        .map((r) => {
          const desc = [r.kana, r.zh, r.mark.visited_on ? `去過 ${r.mark.visited_on}` : '', googleMapsUrl(r.name, r.pref)]
            .filter(Boolean)
            .join('\n')
          return [
            '      <Placemark>',
            `        <name>${xml(r.name)}</name>`,
            `        <description>${xml(desc)}</description>`,
            `        <Point><coordinates>${r.lng},${r.lat},0</coordinates></Point>`,
            '      </Placemark>',
          ].join('\n')
        })
        .join('\n')
      return `    <Folder>\n      <name>${xml(prefectureFullName(pref))}</name>\n${marks}\n    </Folder>`
    })
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

function csvCell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV（UTF-8 BOM，Excel 直接開不會亂碼） */
export function toCsv(rows: MarkedSpot[]): string {
  const head = ['名稱', '假名', '中文名', '羅馬拼音', '都道府縣', '緯度', '經度', 'Google Maps', '收藏', '去過', '去過日期']
  const lines = rows.map((r) =>
    [
      r.name,
      r.kana,
      r.zh,
      r.romaji,
      prefectureFullName(r.pref),
      r.lat,
      r.lng,
      googleMapsUrl(r.name, r.pref),
      r.mark.favorite ? '是' : '',
      r.mark.visited ? '是' : '',
      r.mark.visited_on,
    ]
      .map(csvCell)
      .join(','),
  )
  return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n'
}

/** 檔名不能有的字元換成底線 */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'hitomeguri'
}

export function download(name: string, ext: 'kml' | 'csv', content: string) {
  const type = ext === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'text/csv;charset=utf-8'
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(name)}.${ext}`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
