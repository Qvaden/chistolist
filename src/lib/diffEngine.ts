export interface DiffWordToken {
  type: 'equal' | 'added' | 'removed'
  value: string
}

export interface DiffLineEntry {
  kind: 'equal' | 'added' | 'removed' | 'modified'
  leftLineNumber: number | null
  rightLineNumber: number | null
  tokens: DiffWordToken[]
}

export interface DiffResult {
  lines: DiffLineEntry[]
  stats: {
    similarityPercent: number
    addedWords: number
    removedWords: number
    changedLines: number
  }
}

function lcsMatrix<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (eq(a[i - 1], b[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]
      }
    }
  }
  return dp
}

function diffWords(leftLine: string, rightLine: string): {
  tokens: DiffWordToken[]
  added: number
  removed: number
  equal: number
} {
  const a = leftLine.split(/(\s+)/).filter((t) => t.length > 0)
  const b = rightLine.split(/(\s+)/).filter((t) => t.length > 0)
  const dp = lcsMatrix(a, b, (x, y) => x === y)

  const rev: DiffWordToken[] = []
  let i = a.length
  let j = b.length
  let added = 0
  let removed = 0
  let equal = 0

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      rev.push({ type: 'equal', value: a[i - 1] })
      if (a[i - 1].trim()) equal++
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rev.push({ type: 'added', value: b[j - 1] })
      if (b[j - 1].trim()) added++
      j--
    } else {
      rev.push({ type: 'removed', value: a[i - 1] })
      if (a[i - 1].trim()) removed++
      i--
    }
  }

  return { tokens: rev.reverse(), added, removed, equal }
}

export function computeTextDiff(leftText: string, rightText: string): DiffResult {
  const leftLines = leftText.replace(/\r\n/g, '\n').split('\n')
  const rightLines = rightText.replace(/\r\n/g, '\n').split('\n')

  const dp = lcsMatrix(leftLines, rightLines, (x, y) => x === y)
  type RawOp = { type: 'equal' | 'add' | 'del'; text: string; ln: number }
  const opsRev: RawOp[] = []

  let i = leftLines.length
  let j = rightLines.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      opsRev.push({ type: 'equal', text: leftLines[i - 1], ln: i })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      opsRev.push({ type: 'add', text: rightLines[j - 1], ln: j })
      j--
    } else {
      opsRev.push({ type: 'del', text: leftLines[i - 1], ln: i })
      i--
    }
  }

  const ops = opsRev.reverse()
  const lines: DiffLineEntry[] = []
  let addedWords = 0
  let removedWords = 0
  let equalWords = 0
  let changedLines = 0
  let leftCursor = 1
  let rightCursor = 1

  for (let idx = 0; idx < ops.length; idx++) {
    const cur = ops[idx]

    if (cur.type === 'equal') {
      const words = cur.text.trim() ? cur.text.trim().split(/\s+/).length : 0
      equalWords += words
      lines.push({
        kind: 'equal',
        leftLineNumber: leftCursor++,
        rightLineNumber: rightCursor++,
        tokens: [{ type: 'equal', value: cur.text }],
      })
      continue
    }

    // Collect contiguous block of dels and adds, then pair 1-to-1
    const dels: string[] = []
    const adds: string[] = []
    while (idx < ops.length && ops[idx].type !== 'equal') {
      if (ops[idx].type === 'del') dels.push(ops[idx].text)
      else adds.push(ops[idx].text)
      idx++
    }
    idx-- // step back for outer loop increment

    const paired = Math.min(dels.length, adds.length)
    for (let k = 0; k < paired; k++) {
      const wd = diffWords(dels[k], adds[k])
      addedWords += wd.added
      removedWords += wd.removed
      equalWords += wd.equal
      changedLines++
      lines.push({
        kind: 'modified',
        leftLineNumber: leftCursor++,
        rightLineNumber: rightCursor++,
        tokens: wd.tokens,
      })
    }

    for (let k = paired; k < dels.length; k++) {
      const words = dels[k].trim() ? dels[k].trim().split(/\s+/).length : 0
      removedWords += words
      changedLines++
      lines.push({
        kind: 'removed',
        leftLineNumber: leftCursor++,
        rightLineNumber: null,
        tokens: [{ type: 'removed', value: dels[k] }],
      })
    }

    for (let k = paired; k < adds.length; k++) {
      const words = adds[k].trim() ? adds[k].trim().split(/\s+/).length : 0
      addedWords += words
      changedLines++
      lines.push({
        kind: 'added',
        leftLineNumber: null,
        rightLineNumber: rightCursor++,
        tokens: [{ type: 'added', value: adds[k] }],
      })
    }
  }

  const denom = equalWords + addedWords + removedWords
  const similarityPercent = denom === 0 ? 100 : Math.round((equalWords / denom) * 100)

  return {
    lines,
    stats: {
      similarityPercent,
      addedWords,
      removedWords,
      changedLines,
    },
  }
}

export const SAMPLE_DIFF_LEFT = `ДОГОВОР ПОДРЯДА № 14-А
1. Срок выполнения работ: 15 (пятнадцать) рабочих дней с даты предоплаты.
2. Стоимость услуг: 120 000 рублей, НДС не облагается.
3. Оплата производится в течение 5 банковских дней после подписания акта.
4. Ответственность сторон: пеня за просрочку составляет 0,1% в день, но не более 5% от суммы.
5. Исключительные права переходят Заказчику после полной оплаты.`

export const SAMPLE_DIFF_RIGHT = `ДОГОВОР ПОДРЯДА № 14-А
1. Срок выполнения работ: 10 (десять) рабочих дней с даты подписания.
2. Стоимость услуг: 120 000 рублей, НДС не облагается.
3. Оплата производится в течение 14 банковских дней после подписания акта.
4. Ответственность сторон: пеня за просрочку составляет 0,5% в день без ограничения суммы.
5. Исключительные права переходят Заказчику в момент передачи черновиков.
6. Исполнитель обязуется не оказывать аналогичные услуги конкурентам 24 месяца.`
