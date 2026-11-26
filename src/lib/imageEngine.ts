import { PDFDocument } from 'pdf-lib'

export interface ExifSummary {
  make?: string
  model?: string
  dateTime?: string
  software?: string
  hasGps: boolean
  gpsText?: string
  tagCount: number
}

export interface ImageItem {
  id: string
  file: File
  name: string
  sizeBytes: number
  width: number
  height: number
  previewUrl: string
  exif: ExifSummary
}

export interface ImageProcessOptions {
  format: 'image/jpeg' | 'image/webp' | 'image/png'
  quality: number // 0.5..0.95
  maxDimension: number // 0 = original
  watermarkEnabled: boolean
  watermarkText: string
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`
}

function readAscii(view: DataView, offset: number, count: number): string {
  let out = ''
  const end = Math.min(view.byteLength, offset + count)
  for (let i = offset; i < end; i++) {
    const code = view.getUint8(i)
    if (code === 0) break
    out += String.fromCharCode(code)
  }
  return out.trim()
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset + 8 > view.byteLength) return 0
  const num = view.getUint32(offset, littleEndian)
  const den = view.getUint32(offset + 4, littleEndian)
  return den === 0 ? 0 : num / den
}

function getTagValueOffset(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  typeSize: number,
  count: number,
  littleEndian: boolean
): number {
  const totalBytes = typeSize * count
  if (totalBytes <= 4) {
    return entryOffset + 8
  }
  const relOffset = view.getUint32(entryOffset + 8, littleEndian)
  return tiffStart + relOffset
}

export function parseJpegExif(bytes: Uint8Array): ExifSummary {
  const empty: ExifSummary = { hasGps: false, tagCount: 0 }
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return empty
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 2

  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) break
    const marker = bytes[pos + 1]
    if (marker === 0xda || marker === 0xd9) break // SOS or EOI
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2
      continue
    }
    const segLen = view.getUint16(pos + 2, false)
    if (segLen < 2 || pos + 2 + segLen > bytes.length) break

    if (
      marker === 0xe1 &&
      segLen >= 16 &&
      bytes[pos + 4] === 0x45 && // E
      bytes[pos + 5] === 0x78 && // x
      bytes[pos + 6] === 0x69 && // i
      bytes[pos + 7] === 0x66 && // f
      bytes[pos + 8] === 0x00 &&
      bytes[pos + 9] === 0x00
    ) {
      const tiffStart = pos + 10
      const endian0 = bytes[tiffStart]
      const endian1 = bytes[tiffStart + 1]
      const littleEndian = endian0 === 0x49 && endian1 === 0x49
      if (!littleEndian && !(endian0 === 0x4d && endian1 === 0x4d)) {
        return empty
      }

      const ifd0Rel = view.getUint32(tiffStart + 4, littleEndian)
      const ifd0Offset = tiffStart + ifd0Rel
      if (ifd0Offset + 2 > bytes.length) return empty

      const entries = view.getUint16(ifd0Offset, littleEndian)
      const summary: ExifSummary = { hasGps: false, tagCount: entries }
      let gpsIfdOffset = 0

      for (let i = 0; i < entries; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12
        if (entryOffset + 12 > bytes.length) break
        const tag = view.getUint16(entryOffset, littleEndian)
        const type = view.getUint16(entryOffset + 2, littleEndian)
        const count = view.getUint32(entryOffset + 4, littleEndian)

        if (type === 2) {
          const valOff = getTagValueOffset(view, tiffStart, entryOffset, 1, count, littleEndian)
          const text = readAscii(view, valOff, count)
          if (tag === 0x010f && text) summary.make = text
          if (tag === 0x0110 && text) summary.model = text
          if (tag === 0x0131 && text) summary.software = text
          if (tag === 0x0132 && text) summary.dateTime = text
        } else if (tag === 0x8825 && count >= 1) {
          const rel = view.getUint32(entryOffset + 8, littleEndian)
          gpsIfdOffset = tiffStart + rel
        }
      }

      if (gpsIfdOffset > 0 && gpsIfdOffset + 2 <= bytes.length) {
        const gpsEntries = view.getUint16(gpsIfdOffset, littleEndian)
        summary.tagCount += gpsEntries
        let latRef = 'N'
        let lonRef = 'E'
        let lat: number | null = null
        let lon: number | null = null

        for (let i = 0; i < gpsEntries; i++) {
          const entryOffset = gpsIfdOffset + 2 + i * 12
          if (entryOffset + 12 > bytes.length) break
          const tag = view.getUint16(entryOffset, littleEndian)
          const type = view.getUint16(entryOffset + 2, littleEndian)
          const count = view.getUint32(entryOffset + 4, littleEndian)

          if (tag === 0x0001 && type === 2) {
            const valOff = getTagValueOffset(view, tiffStart, entryOffset, 1, count, littleEndian)
            latRef = readAscii(view, valOff, count) || 'N'
          } else if (tag === 0x0003 && type === 2) {
            const valOff = getTagValueOffset(view, tiffStart, entryOffset, 1, count, littleEndian)
            lonRef = readAscii(view, valOff, count) || 'E'
          } else if (tag === 0x0002 && type === 5 && count >= 3) {
            const valOff = getTagValueOffset(view, tiffStart, entryOffset, 8, count, littleEndian)
            const d = readRational(view, valOff, littleEndian)
            const m = readRational(view, valOff + 8, littleEndian)
            const s = readRational(view, valOff + 16, littleEndian)
            lat = d + m / 60 + s / 3600
          } else if (tag === 0x0004 && type === 5 && count >= 3) {
            const valOff = getTagValueOffset(view, tiffStart, entryOffset, 8, count, littleEndian)
            const d = readRational(view, valOff, littleEndian)
            const m = readRational(view, valOff + 8, littleEndian)
            const s = readRational(view, valOff + 16, littleEndian)
            lon = d + m / 60 + s / 3600
          }
        }

        if (lat !== null && lon !== null) {
          summary.hasGps = true
          summary.gpsText = `${lat.toFixed(4)}° ${latRef}, ${lon.toFixed(4)}° ${lonRef}`
        } else if (gpsEntries > 0) {
          summary.hasGps = true
        }
      }

      return summary
    }

    pos += 2 + segLen
  }

  return empty
}

function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Не удалось загрузить изображение.'))
    img.src = url
  })
}

export async function loadImageItems(files: FileList | File[]): Promise<ImageItem[]> {
  const results: ImageItem[] = []
  for (const file of Array.from(files)) {
    const isImage =
      file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!isImage) continue

    const bytes = new Uint8Array(await file.arrayBuffer())
    const exif = parseJpegExif(bytes)
    const previewUrl = URL.createObjectURL(file)
    try {
      const dims = await loadImageDimensions(previewUrl)
      results.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        width: dims.width,
        height: dims.height,
        previewUrl,
        exif,
      })
    } catch {
      URL.revokeObjectURL(previewUrl)
    }
  }
  return results
}

export async function processImageItem(
  item: ImageItem,
  options: ImageProcessOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Ошибка декодирования изображения'))
    img.src = item.previewUrl
  })

  let targetW = img.naturalWidth
  let targetH = img.naturalHeight

  if (options.maxDimension > 0) {
    const longest = Math.max(targetW, targetH)
    if (longest > options.maxDimension) {
      const scale = options.maxDimension / longest
      targetW = Math.round(targetW * scale)
      targetH = Math.round(targetH * scale)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен')

  ctx.drawImage(img, 0, 0, targetW, targetH)

  if (options.watermarkEnabled && options.watermarkText.trim()) {
    ctx.save()
    const fontSize = Math.max(18, Math.round(targetW * 0.048))
    ctx.font = `700 ${fontSize}px Manrope, sans-serif`
    ctx.fillStyle = 'rgba(190, 35, 35, 0.28)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.translate(targetW / 2, targetH / 2)
    ctx.rotate(-Math.PI / 6)
    ctx.fillText(options.watermarkText.trim(), 0, 0)
    ctx.restore()
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(
      (b) => resolve(b),
      options.format,
      options.format === 'image/png' ? undefined : options.quality
    )
  )

  if (!blob) throw new Error('Не удалось экспортировать изображение')
  return { blob, width: targetW, height: targetH }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportImagesAsPdf(
  items: ImageItem[],
  options: ImageProcessOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const item of items) {
    const { blob, width, height } = await processImageItem(item, {
      ...options,
      format: 'image/jpeg',
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const jpg = await doc.embedJpg(bytes)
    const page = doc.addPage([width, height])
    page.drawImage(jpg, { x: 0, y: 0, width, height })
  }
  return doc.save()
}

function buildDemoExifApp1Segment(): Uint8Array {
  // Construct a valid little-endian TIFF APP1 segment with Make, Model, Software, DateTime, and GPS
  const buf = new ArrayBuffer(512)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)

  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      bytes[off + i] = str.charCodeAt(i)
    }
    bytes[off + str.length] = 0
  }

  // Marker + placeholder length
  bytes[0] = 0xff
  bytes[1] = 0xe1
  writeStr(4, 'Exif\0')
  bytes[9] = 0x00

  const tiff = 10
  // Little endian 'II', 42, IFD0 offset = 8
  bytes[tiff] = 0x49
  bytes[tiff + 1] = 0x49
  view.setUint16(tiff + 2, 42, true)
  view.setUint32(tiff + 4, 8, true)

  const ifd0 = tiff + 8 // 18
  const ifd0Count = 5
  view.setUint16(ifd0, ifd0Count, true)

  let dataCursor = ifd0 + 2 + ifd0Count * 12 + 4 // 18 + 66 = 84
  const writeEntry = (
    idx: number,
    tag: number,
    type: number,
    count: number,
    valueOrOffset: number
  ) => {
    const off = ifd0 + 2 + idx * 12
    view.setUint16(off, tag, true)
    view.setUint16(off + 2, type, true)
    view.setUint32(off + 4, count, true)
    view.setUint32(off + 8, valueOrOffset, true)
  }

  const writeAsciiTag = (idx: number, tag: number, str: string) => {
    const len = str.length + 1
    writeStr(dataCursor, str)
    writeEntry(idx, tag, 2, len, dataCursor - tiff)
    dataCursor += len
  }

  writeAsciiTag(0, 0x010f, 'Apple')
  writeAsciiTag(1, 0x0110, 'Phone 16 Pro')
  writeAsciiTag(2, 0x0131, 'iOS 19.2')
  writeAsciiTag(3, 0x0132, '2026:11:26 14:35:10')

  // Align to 2 bytes for GPS IFD
  if (dataCursor % 2 !== 0) dataCursor++
  const gpsIfd = dataCursor
  writeEntry(4, 0x8825, 4, 1, gpsIfd - tiff)
  view.setUint32(ifd0 + 2 + ifd0Count * 12, 0, true) // next IFD = 0

  const gpsCount = 4
  view.setUint16(gpsIfd, gpsCount, true)
  let gpsData = gpsIfd + 2 + gpsCount * 12 + 4

  const writeGpsInlineStr = (idx: number, tag: number, str: string) => {
    const off = gpsIfd + 2 + idx * 12
    view.setUint16(off, tag, true)
    view.setUint16(off + 2, 2, true)
    view.setUint32(off + 4, 2, true)
    bytes[off + 8] = str.charCodeAt(0)
    bytes[off + 9] = 0
  }

  const writeGpsRationals = (
    idx: number,
    tag: number,
    triples: [number, number][]
  ) => {
    const off = gpsIfd + 2 + idx * 12
    view.setUint16(off, tag, true)
    view.setUint16(off + 2, 5, true)
    view.setUint32(off + 4, triples.length, true)
    view.setUint32(off + 8, gpsData - tiff, true)
    for (const [n, d] of triples) {
      view.setUint32(gpsData, n, true)
      view.setUint32(gpsData + 4, d, true)
      gpsData += 8
    }
  }

  writeGpsInlineStr(0, 0x0001, 'N')
  writeGpsRationals(1, 0x0002, [
    [55, 1],
    [45, 1],
    [2088, 100],
  ])
  writeGpsInlineStr(2, 0x0003, 'E')
  writeGpsRationals(3, 0x0004, [
    [37, 1],
    [37, 1],
    [228, 100],
  ])
  view.setUint32(gpsIfd + 2 + gpsCount * 12, 0, true)

  const totalLen = gpsData
  view.setUint16(2, totalLen - 2, false)
  return bytes.slice(0, totalLen)
}

export async function generateSamplePhotoWithExif(): Promise<File> {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1600
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#F5F6F8'
    ctx.fillRect(0, 0, 1200, 1600)

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(70, 90, 1060, 1420)
    ctx.strokeStyle = '#D1D5DB'
    ctx.lineWidth = 3
    ctx.strokeRect(70, 90, 1060, 1420)

    ctx.fillStyle = '#111827'
    ctx.font = '700 36px Manrope, sans-serif'
    ctx.fillText('КВИТАНЦИЯ ОБ ОПЛАТЕ № 8921-А', 140, 210)

    ctx.font = '400 26px Manrope, sans-serif'
    ctx.fillStyle = '#374151'
    const lines = [
      'Дата операции: 26.11.2026  14:34',
      'Плательщик: Соколов Артём Викторович',
      'Получатель: ООО «Городской Сервис»',
      'Сумма платежа: 24 800,00 ₽',
      'Статус: Исполнено банком',
    ]
    let y = 310
    for (const line of lines) {
      ctx.fillText(line, 140, y)
      y += 58
    }
  }

  const rawBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
  )
  if (!rawBlob) {
    throw new Error('Не удалось сгенерировать демо-фото')
  }

  const jpgBytes = new Uint8Array(await rawBlob.arrayBuffer())
  const app1 = buildDemoExifApp1Segment()
  const merged = new Uint8Array(jpgBytes.length + app1.length)
  merged.set(jpgBytes.slice(0, 2), 0) // FF D8
  merged.set(app1, 2)
  merged.set(jpgBytes.slice(2), 2 + app1.length)

  return new File([merged], 'скан_квитанции_с_exif.jpg', { type: 'image/jpeg' })
}
