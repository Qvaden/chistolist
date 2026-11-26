export interface MaskMapping {
  placeholder: string
  original: string
  category: 'contacts' | 'docs' | 'finance' | 'custom'
}

export interface AnonymizeOptions {
  maskContacts: boolean
  maskDocs: boolean
  maskFinance: boolean
  customWords: string
}

export interface AnonymizeResult {
  maskedText: string
  mappings: MaskMapping[]
  stats: {
    total: number
    contacts: number
    docs: number
    finance: number
    custom: number
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function anonymizeText(input: string, options: AnonymizeOptions): AnonymizeResult {
  if (!input) {
    return {
      maskedText: '',
      mappings: [],
      stats: { total: 0, contacts: 0, docs: 0, finance: 0, custom: 0 },
    }
  }

  let output = input
  const mappings: MaskMapping[] = []
  const valueToPlaceholder = new Map<string, string>()
  const counters: Record<string, number> = {}
  const stats = { total: 0, contacts: 0, docs: 0, finance: 0, custom: 0 }

  const registerMask = (
    original: string,
    label: string,
    category: MaskMapping['category']
  ): string => {
    const existing = valueToPlaceholder.get(original)
    if (existing) return existing

    counters[label] = (counters[label] ?? 0) + 1
    const placeholder = `[${label}_${counters[label]}]`
    valueToPlaceholder.set(original, placeholder)
    mappings.push({ placeholder, original, category })
    stats.total++
    stats[category]++
    return placeholder
  }

  // 1. Custom stop-words first (e.g., company names, surnames)
  const customList = options.customWords
    .split(/[,;\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)

  for (const word of customList) {
    const rx = new RegExp(escapeRegExp(word), 'gi')
    output = output.replace(rx, (match) => registerMask(match, 'СКРЫТО', 'custom'))
  }

  // 2. Finance: 20-digit Russian bank accounts & 16-digit bank cards
  if (options.maskFinance) {
    output = output.replace(/\b(?:40702|40802|40817|30101)\d{15}\b/g, (match) =>
      registerMask(match, 'СЧЁТ', 'finance')
    )
    output = output.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, (match) =>
      registerMask(match, 'КАРТА', 'finance')
    )
  }

  // 3. Documents: Passports, SNILS, OGRN, INN
  if (options.maskDocs) {
    output = output.replace(
      /(?:паспорт\s*)?(?:серия\s*)?(?<!\d)\d{2}\s?\d{2}\s*(?:№|номер)?\s*\d{6}(?!\d)/gi,
      (match) => registerMask(match, 'ПАСПОРТ', 'docs')
    )
    output = output.replace(/(?<!\d)\d{3}-\d{3}-\d{3}[-\s]\d{2}(?!\d)/g, (match) =>
      registerMask(match, 'СНИЛС', 'docs')
    )
    output = output.replace(/(?:ОГРНИП|ОГРН)\s*[:№]?\s*\d{13,15}(?!\d)/gi, (match) =>
      registerMask(match, 'ОГРН', 'docs')
    )
    output = output.replace(/(?:ИНН\s*[:№]?\s*\d{10,12}(?!\d)|(?<!\d)\d{10}(?!\d)|(?<!\d)\d{12}(?!\d))/gi, (match) => {
      return registerMask(match, 'ИНН', 'docs')
    })
  }

  // 4. Contacts: Emails & Russian phones
  if (options.maskContacts) {
    output = output.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      (match) => registerMask(match, 'EMAIL', 'contacts')
    )
    output = output.replace(
      /(?<!\d)(?:\+7|8|7)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g,
      (match) => registerMask(match, 'ТЕЛЕФОН', 'contacts')
    )
  }

  return { maskedText: output, mappings, stats }
}

export function deanonymizeText(text: string, mappings: MaskMapping[]): string {
  if (!text || mappings.length === 0) return text
  let out = text
  for (const m of mappings) {
    out = out.split(m.placeholder).join(m.original)
  }
  return out
}

export const SAMPLE_ANONYMIZER_TEXT = `Коллеги, направляю реквизиты по договору с ООО «Вектор Логистик»:
Контактное лицо: Соколов Артём Викторович, тел. +7 (999) 412-88-10, почта sokolov.artem@vector-log.ru.
Данные для доверенности: паспорт серия 45 19 № 884210, СНИЛС 112-233-445 95, ИНН 771234567890, ОГРНИП 324774600012345.
Расчётный счёт для оплаты: 40802810400001234567, карта для возврата 2200 7001 4412 8890.
Просьба проверить формулировки и подготовить ответ клиенту.`
