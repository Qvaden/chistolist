import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument } from 'pdf-lib'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export interface NormalizedRect {
  id: string
  x: number // 0..1
  y: number // 0..1
  w: number // 0..1
  h: number // 0..1
}

export interface PdfPageItem {
  id: string
  sourceName: string
  sourceBytes: Uint8Array
  sourcePageIndex: number
  widthPt: number
  heightPt: number
  thumbUrl: string
  redactions: NormalizedRect[]
}

export interface WatermarkConfig {
  enabled: boolean
  text: string
  opacity: number // 0.05..0.6
  mode: 'center' | 'tiled'
}

export async function loadPdfPages(file: File): Promise<PdfPageItem[]> {
  const arrayBuffer = await file.arrayBuffer()
  const sourceBytes = new Uint8Array(arrayBuffer)

  const loadingTask = pdfjsLib.getDocument({ data: sourceBytes.slice(0) })
  const pdf = await loadingTask.promise

  try {
    const items: PdfPageItem[] = []
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport1 = page.getViewport({ scale: 1 })
      const thumbScale = 220 / viewport1.width
      const thumbViewport = page.getViewport({ scale: thumbScale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(thumbViewport.width)
      canvas.height = Math.ceil(thumbViewport.height)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: thumbViewport, canvas }).promise
      }

      items.push({
        id: `${Date.now()}-${pageNum}-${Math.random().toString(36).slice(2, 7)}`,
        sourceName: file.name,
        sourceBytes,
        sourcePageIndex: pageNum - 1,
        widthPt: viewport1.width,
        heightPt: viewport1.height,
        thumbUrl: canvas.toDataURL('image/png'),
        redactions: [],
      })
    }
    return items
  } finally {
    await loadingTask.destroy()
  }
}

export async function renderPdfPageToCanvas(
  pageItem: PdfPageItem,
  canvas: HTMLCanvasElement,
  maxWidthPx: number
): Promise<void> {
  const loadingTask = pdfjsLib.getDocument({ data: pageItem.sourceBytes.slice(0) })
  const pdf = await loadingTask.promise

  try {
    const page = await pdf.getPage(pageItem.sourcePageIndex + 1)
    const baseViewport = page.getViewport({ scale: 1 })
    const cssScale = maxWidthPx / baseViewport.width
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const renderViewport = page.getViewport({ scale: cssScale * dpr })

    canvas.width = Math.ceil(renderViewport.width)
    canvas.height = Math.ceil(renderViewport.height)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise
  } finally {
    await loadingTask.destroy()
  }
}

function drawWatermarkOnContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wm: WatermarkConfig
): void {
  if (!wm.enabled || !wm.text.trim()) return

  ctx.save()
  ctx.fillStyle = `rgba(180, 35, 35, ${wm.opacity})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const text = wm.text.trim()

  if (wm.mode === 'center') {
    const fontSize = Math.max(18, Math.round(width * 0.055))
    ctx.font = `700 ${fontSize}px Manrope, sans-serif`
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 6)
    ctx.fillText(text, 0, 0)
  } else {
    const fontSize = Math.max(13, Math.round(width * 0.032))
    ctx.font = `600 ${fontSize}px Manrope, sans-serif`
    const stepX = Math.max(200, width * 0.42)
    const stepY = Math.max(130, height * 0.22)
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 6)
    for (let y = -height; y <= height; y += stepY) {
      for (let x = -width; x <= width; x += stepX) {
        ctx.fillText(text, x, y)
      }
    }
  }

  ctx.restore()
}

async function createWatermarkPngBytes(
  widthPt: number,
  heightPt: number,
  wm: WatermarkConfig
): Promise<Uint8Array> {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(widthPt * scale)
  canvas.height = Math.ceil(heightPt * scale)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    drawWatermarkOnContext(ctx, canvas.width, canvas.height, wm)
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  )
  if (!blob) return new Uint8Array()
  return new Uint8Array(await blob.arrayBuffer())
}

export interface ExportPdfResult {
  bytes: Uint8Array
  exportedPages: number
}

export async function exportProcessedPdf(
  pages: PdfPageItem[],
  watermark: WatermarkConfig
): Promise<ExportPdfResult> {
  const outDoc = await PDFDocument.create()
  const sourceCache = new Map<Uint8Array, PDFDocument>()

  for (const item of pages) {
    if (item.redactions.length > 0) {
      const loadingTask = pdfjsLib.getDocument({ data: item.sourceBytes.slice(0) })
      const pdf = await loadingTask.promise
      try {
        const page = await pdf.getPage(item.sourcePageIndex + 1)
        const viewport = page.getViewport({ scale: 2 })

        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas }).promise

          ctx.fillStyle = '#000000'
          for (const rect of item.redactions) {
            ctx.fillRect(
              rect.x * canvas.width,
              rect.y * canvas.height,
              rect.w * canvas.width,
              rect.h * canvas.height
            )
          }

          if (watermark.enabled && watermark.text.trim()) {
            drawWatermarkOnContext(ctx, canvas.width, canvas.height, watermark)
          }
        }

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        )
        if (blob) {
          const pngBytes = new Uint8Array(await blob.arrayBuffer())
          const img = await outDoc.embedPng(pngBytes)
          const outPage = outDoc.addPage([item.widthPt, item.heightPt])
          outPage.drawImage(img, {
            x: 0,
            y: 0,
            width: item.widthPt,
            height: item.heightPt,
          })
        }
      } finally {
        await loadingTask.destroy()
      }
    } else {
      let srcDoc = sourceCache.get(item.sourceBytes)
      if (!srcDoc) {
        srcDoc = await PDFDocument.load(item.sourceBytes)
        sourceCache.set(item.sourceBytes, srcDoc)
      }
      const [copied] = await outDoc.copyPages(srcDoc, [item.sourcePageIndex])
      const outPage = outDoc.addPage(copied)

      if (watermark.enabled && watermark.text.trim()) {
        const wmBytes = await createWatermarkPngBytes(item.widthPt, item.heightPt, watermark)
        if (wmBytes.length > 0) {
          const wmImg = await outDoc.embedPng(wmBytes)
          outPage.drawImage(wmImg, {
            x: 0,
            y: 0,
            width: item.widthPt,
            height: item.heightPt,
          })
        }
      }
    }
  }

  const bytes = await outDoc.save()
  return {
    bytes,
    exportedPages: pages.length,
  }
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export async function generateSampleContractPdf(): Promise<File> {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  const doc = await PDFDocument.create()
  const pagesText = [
    [
      'ДОГОВОР ОКАЗАНИЯ УСЛУГ № 418-Д/2026',
      'г. Москва                                                    26 ноября 2026 г.',
      '',
      'Исполнитель: ИП Соколов Артём Викторович',
      'ИНН: 771234567890   ОГРНИП: 324774600012345',
      'Паспорт: серия 45 19  № 884210, выдан ГУ МВД России по г. Москве',
      'Телефон для связи: +7 (999) 412-88-10',
      '',
      '1. ПРЕДМЕТ ДОГОВОРА',
      'Исполнитель обязуется оказать консультационные услуги по аудиту',
      'бизнес-процессов Заказчика, а Заказчик обязуется принять и оплатить их.',
      '',
      '2. СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ',
      'Стоимость услуг составляет 145 000 (Сто сорок пять тысяч) рублей.',
      'Банковские реквизиты: р/с 40802810400001234567 в АО «Т-Банк».',
    ],
    [
      'ПРИЛОЖЕНИЕ № 1 — АКТ ПРИЁМА-ПЕРЕДАЧИ',
      '',
      'Стороны подтверждают, что обязательства по этапу № 1 выполнены в полном',
      'объёме и в согласованные сроки. Претензий по качеству стороны не имеют.',
      '',
      'Заказчик: ООО «Вектор Логистик» (ИНН 7709876543)',
      'Контактное лицо: Смирнова Е. А., тел. +7 (916) 700-33-21',
      '',
      'Подпись Исполнителя: _______________ / Соколов А. В. /',
      'Подпись Заказчика:   _______________ / Смирнова Е. А. /',
    ],
  ]

  for (const lines of pagesText) {
    const canvas = document.createElement('canvas')
    canvas.width = 1190
    canvas.height = 1684
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#111827'
      ctx.font = '700 30px Manrope, sans-serif'
      ctx.fillText(lines[0], 90, 120)

      ctx.strokeStyle = '#D1D5DB'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(90, 148)
      ctx.lineTo(1100, 148)
      ctx.stroke()

      ctx.font = '400 24px Manrope, sans-serif'
      let y = 205
      for (const line of lines.slice(1)) {
        ctx.fillText(line, 90, y)
        y += 42
      }
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    )
    if (blob) {
      const img = await doc.embedPng(new Uint8Array(await blob.arrayBuffer()))
      const page = doc.addPage([595, 842])
      page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 })
    }
  }

  const bytes = await doc.save()
  return new File([bytes.buffer as ArrayBuffer], 'договор_демо_418.pdf', {
    type: 'application/pdf',
  })
}
