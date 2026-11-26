import * as XLSX from 'xlsx'

export interface ParsedTable {
  fileName: string
  headers: string[]
  rows: string[][]
}

export interface CleanOptions {
  trimAndCollapse: boolean
  removeEmptyRows: boolean
  deduplicate: boolean
  dedupeColumn: string // '__all__' or column name
  normalizePhones: boolean
  phoneColumn: string // '__auto__' or column name
  phoneFormat: 'digits' | 'formatted'
  normalizeEmails: boolean
  splitFio: boolean
  fioColumn: string // '__auto__' or column name
}

export interface CleanStats {
  originalRows: number
  finalRows: number
  removedEmpty: number
  removedDuplicates: number
  normalizedPhones: number
  cleanedCells: number
}

export interface CleanResult {
  headers: string[]
  rows: string[][]
  changedCells: Set<string>
  stats: CleanStats
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

export async function parseSpreadsheet(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('Файл не содержит листов с данными.')
  }
  const sheet = workbook.Sheets[firstSheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  if (matrix.length === 0) {
    throw new Error('Таблица пуста.')
  }

  const rawHeaders = matrix[0].map((cell, idx) => {
    const s = cellToString(cell).trim()
    return s || `Колонка ${idx + 1}`
  })

  const colCount = rawHeaders.length
  const rows = matrix.slice(1).map((row) => {
    const out: string[] = []
    for (let i = 0; i < colCount; i++) {
      out.push(cellToString(row[i]))
    }
    return out
  })

  return {
    fileName: file.name,
    headers: rawHeaders,
    rows,
  }
}

function findColumnIndex(headers: string[], preferred: string, keywords: string[]): number {
  if (preferred !== '__auto__') {
    return headers.indexOf(preferred)
  }
  const lower = headers.map((h) => h.toLowerCase())
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw))
    if (idx !== -1) return idx
  }
  return -1
}

function normalizeRuPhone(raw: string, format: 'digits' | 'formatted'): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')

  let normalized11: string | null = null
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    normalized11 = '7' + digits.slice(1)
  } else if (digits.length === 10 && digits.startsWith('9')) {
    normalized11 = '7' + digits
  }

  if (!normalized11) return null

  if (format === 'digits') {
    return normalized11
  }

  const p1 = normalized11.slice(1, 4)
  const p2 = normalized11.slice(4, 7)
  const p3 = normalized11.slice(7, 9)
  const p4 = normalized11.slice(9, 11)
  return `+7 (${p1}) ${p2}-${p3}-${p4}`
}

export function cleanSpreadsheet(
  table: ParsedTable,
  options: CleanOptions
): CleanResult {
  const originalRows = table.rows.length

  let headers = [...table.headers]
  let rows = table.rows.map((r) => [...r])

  let removedEmpty = 0
  let removedDuplicates = 0
  let normalizedPhones = 0
  let cleanedCells = 0

  const phoneIdx = options.normalizePhones
    ? findColumnIndex(headers, options.phoneColumn, ['тел', 'phone', 'моб', 'номер'])
    : -1

  const emailIdx = options.normalizeEmails
    ? findColumnIndex(headers, '__auto__', ['mail', 'почт', 'e-mail'])
    : -1

  // Track changes on final rows by storing pre-clean snapshot per row object
  const rowSnapshots = rows.map((r) => [...r])

  // Step 1: Trim & collapse whitespace / invisible chars
  if (options.trimAndCollapse) {
    rows = rows.map((row) =>
      row.map((cell) => {
        const next = cell
          .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (next !== cell) cleanedCells++
        return next
      })
    )
  }

  // Step 2: Remove empty rows
  if (options.removeEmptyRows) {
    const kept: string[][] = []
    const keptSnaps: string[][] = []
    for (let i = 0; i < rows.length; i++) {
      const isEmpty = rows[i].every((c) => c.trim() === '')
      if (isEmpty) {
        removedEmpty++
      } else {
        kept.push(rows[i])
        keptSnaps.push(rowSnapshots[i])
      }
    }
    rows = kept
    rowSnapshots.splice(0, rowSnapshots.length, ...keptSnaps)
  }

  // Step 3: Normalize phones & emails
  for (let i = 0; i < rows.length; i++) {
    if (phoneIdx !== -1 && rows[i][phoneIdx] !== undefined) {
      const prev = rows[i][phoneIdx]
      const norm = normalizeRuPhone(prev, options.phoneFormat)
      if (norm && norm !== prev) {
        rows[i][phoneIdx] = norm
        normalizedPhones++
        cleanedCells++
      }
    }

    if (emailIdx !== -1 && rows[i][emailIdx] !== undefined) {
      const prev = rows[i][emailIdx]
      const next = prev.trim().toLowerCase()
      if (next !== prev) {
        rows[i][emailIdx] = next
        cleanedCells++
      }
    }
  }

  // Step 4: Deduplicate
  if (options.deduplicate) {
    const dedupeColIdx =
      options.dedupeColumn === '__all__' ? -1 : headers.indexOf(options.dedupeColumn)
    const seen = new Set<string>()
    const kept: string[][] = []
    const keptSnaps: string[][] = []

    for (let i = 0; i < rows.length; i++) {
      const key =
        dedupeColIdx === -1
          ? rows[i].map((c) => c.trim().toLowerCase()).join('\u0001')
          : (rows[i][dedupeColIdx] ?? '').trim().toLowerCase()

      if (key !== '' && seen.has(key)) {
        removedDuplicates++
      } else {
        if (key !== '') seen.add(key)
        kept.push(rows[i])
        keptSnaps.push(rowSnapshots[i])
      }
    }
    rows = kept
    rowSnapshots.splice(0, rowSnapshots.length, ...keptSnaps)
  }

  // Step 5: Optional split FIO into 3 columns
  const fioIdx = options.splitFio
    ? findColumnIndex(headers, options.fioColumn, ['фио', 'клиент', 'имя', 'name'])
    : -1

  if (fioIdx !== -1) {
    const newHeaders = [
      ...headers.slice(0, fioIdx),
      'Фамилия',
      'Имя',
      'Отчество',
      ...headers.slice(fioIdx + 1),
    ]
    headers = newHeaders
    rows = rows.map((row) => {
      const parts = (row[fioIdx] ?? '').trim().split(/\s+/).filter(Boolean)
      const last = parts[0] ?? ''
      const first = parts[1] ?? ''
      const middle = parts.slice(2).join(' ')
      return [...row.slice(0, fioIdx), last, first, middle, ...row.slice(fioIdx + 1)]
    })
  }

  // Compute changed cells for visual diff highlight
  const changedCells = new Set<string>()
  if (fioIdx === -1) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] !== rowSnapshots[r][c]) {
          changedCells.add(`${r}:${c}`)
        }
      }
    }
  } else {
    for (let r = 0; r < rows.length; r++) {
      changedCells.add(`${r}:${fioIdx}`)
      changedCells.add(`${r}:${fioIdx + 1}`)
      changedCells.add(`${r}:${fioIdx + 2}`)
    }
  }

  return {
    headers,
    rows,
    changedCells,
    stats: {
      originalRows,
      finalRows: rows.length,
      removedEmpty,
      removedDuplicates,
      normalizedPhones,
      cleanedCells,
    },
  }
}

export function exportCleanFile(
  headers: string[],
  rows: string[][],
  format: 'xlsx' | 'csv',
  originalFileName: string
): void {
  const base = originalFileName.replace(/\.[^.]+$/, '') || 'table'
  const aoa = [headers, ...rows]
  const sheet = XLSX.utils.aoa_to_sheet(aoa)

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Очищено')
    XLSX.writeFile(wb, `${base}_clean.xlsx`)
    return
  }

  const csvText = '\uFEFF' + XLSX.utils.sheet_to_csv(sheet, { FS: ';' })
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${base}_clean.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function generateSampleSpreadsheet(): ParsedTable {
  const names = [
    '  Иванов   Алексей Сергеевич ',
    'Петрова Мария   Ивановна',
    'Сидоров Дмитрий\u00A0Павлович',
    'Козлова  Елена Владимировна ',
    'Новиков Артём Андреевич',
    'Морозова Ольга Николаевна',
  ]
  const phones = [
    '+7 (999) 123-45-67',
    '89165554433',
    '926-777-88-99',
    '8 (903) 111 22 33',
    '79053332211',
    '+7 985 900-10-20',
  ]
  const cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск']
  const rows: string[][] = []

  for (let i = 0; i < 96; i++) {
    if (i % 19 === 4) {
      rows.push(['', '', '', '', ''])
      continue
    }
    const idx = i % names.length
    const city = cities[i % cities.length]
    const email = `  Client.${idx + 1}@Example.RU `
    const sum = `${1500 + (i % 7) * 450}`
    rows.push([names[idx], phones[idx], email, city, sum])
  }

  return {
    fileName: 'выгрузка_клиентов_crm_демо.xlsx',
    headers: ['ФИО', 'Телефон', 'Email', 'Город', 'Чек, ₽'],
    rows,
  }
}
