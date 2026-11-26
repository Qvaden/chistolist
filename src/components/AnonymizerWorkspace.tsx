import {
  ArrowRightLeft,
  Copy,
  Eraser,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  SAMPLE_ANONYMIZER_TEXT,
  anonymizeText,
  deanonymizeText,
} from '../lib/anonymizerEngine'

interface AnonymizerWorkspaceProps {
  onNotify: (message: string) => void
}

export function AnonymizerWorkspace({ onNotify }: AnonymizerWorkspaceProps) {
  const [sourceText, setSourceText] = useState('')
  const [maskContacts, setMaskContacts] = useState(true)
  const [maskDocs, setMaskDocs] = useState(true)
  const [maskFinance, setMaskFinance] = useState(true)
  const [customWords, setCustomWords] = useState('Вектор Логистик, Соколов Артём Викторович')
  const [aiReplyText, setAiReplyText] = useState('')

  const result = useMemo(
    () =>
      anonymizeText(sourceText, {
        maskContacts,
        maskDocs,
        maskFinance,
        customWords,
      }),
    [sourceText, maskContacts, maskDocs, maskFinance, customWords]
  )

  const restoredText = useMemo(
    () => deanonymizeText(aiReplyText, result.mappings),
    [aiReplyText, result.mappings]
  )

  const copyText = async (text: string, label: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      onNotify(`${label} скопирован в буфер обмена`)
    } catch {
      onNotify('Не удалось скопировать — выделите текст вручную')
    }
  }

  return (
    <div className="panel-inner">
      <div className="metrics-strip">
        <div className="metric-box">
          <div className="metric-label">Скрыто данных</div>
          <div className="metric-value tabular is-secure">{result.stats.total}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Телефоны и Email</div>
          <div className="metric-value tabular">{result.stats.contacts}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Паспорт / ИНН / СНИЛС</div>
          <div className="metric-value tabular">{result.stats.docs}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Счета и стоп-слова</div>
          <div className="metric-value tabular">
            {result.stats.finance + result.stats.custom}
          </div>
        </div>
      </div>

      <div className="workbench">
        <aside className="card" aria-label="Правила обезличивания">
          <div className="card-header">
            <h2 className="card-title">Что скрывать</h2>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSourceText('')
                setAiReplyText('')
              }}
            >
              <Eraser size={14} aria-hidden="true" />
              <span>Очистить</span>
            </button>
          </div>

          <div className="control-group">
            <label className="toggle-row">
              <span>
                <span className="toggle-label">Телефоны и Email</span>
                <span className="toggle-hint">+7, 8, почтовые адреса</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={maskContacts}
                onChange={(e) => setMaskContacts(e.target.checked)}
              />
            </label>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Паспорт, ИНН, СНИЛС</span>
                <span className="toggle-hint">Серия/номер, ИНН, ОГРН</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={maskDocs}
                onChange={(e) => setMaskDocs(e.target.checked)}
              />
            </label>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Счета и номера карт</span>
                <span className="toggle-hint">20-значные р/с и 16-значные карты</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={maskFinance}
                onChange={(e) => setMaskFinance(e.target.checked)}
              />
            </label>

            <label className="field-label">
              <span>Свои стоп-слова (через запятую)</span>
              <input
                type="text"
                className="input"
                placeholder="Иванов, ООО Ромашка..."
                value={customWords}
                onChange={(e) => setCustomWords(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="btn"
              onClick={() => {
                setSourceText(SAMPLE_ANONYMIZER_TEXT)
                onNotify('Вставлен демо-текст с персональными данными')
              }}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>Вставить демо-текст</span>
            </button>
          </div>
        </aside>

        <section className="card" aria-label="Редактор обезличивания">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2 className="card-title">Безопасная подготовка текста перед отправкой</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                Убирает персональные данные перед вставкой в нейросети или пересылкой коллегам
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!result.maskedText}
              onClick={() => void copyText(result.maskedText, 'Обезличенный текст')}
            >
              <Copy size={15} aria-hidden="true" />
              <span>Копировать результат</span>
            </button>
          </div>

          <div className="split-editor">
            <label className="field-label">
              <span>Исходный текст</span>
              <textarea
                className="input textarea-code"
                rows={8}
                placeholder="Вставьте письмо, договор или карточку клиента с телефонами, паспортом и счетами..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />
            </label>

            <label className="field-label">
              <span>Обезличенный текст (можно безопасно копировать)</span>
              <textarea
                className="input textarea-code"
                rows={8}
                readOnly
                placeholder="Здесь появится текст с заменами вида [ТЕЛЕФОН_1], [ИНН_1]..."
                value={result.maskedText}
              />
            </label>
          </div>

          {result.mappings.length > 0 ? (
            <div className="mask-chips" aria-label="Таблица замен">
              {result.mappings.map((m) => (
                <span key={m.placeholder} className="tag-pill">
                  <UserX size={12} aria-hidden="true" />
                  <code className="mono">{m.placeholder}</code>
                  <span>= {m.original}</span>
                </span>
              ))}
            </div>
          ) : (
            <div
              style={{
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                color: 'var(--ink-secondary)',
              }}
            >
              <ShieldAlert size={15} aria-hidden="true" />
              <span>Вставьте текст слева или нажмите «Вставить демо-текст» для проверки.</span>
            </div>
          )}

          <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '18px 0' }} />

          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={16} aria-hidden="true" />
                <span>Обратная расшифровка ответа</span>
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                Вставьте сюда ответ с метками <code className="mono">[ТЕЛЕФОН_1]</code> — сервис
                локально вернёт реальные данные
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!restoredText}
              onClick={() => void copyText(restoredText, 'Расшифрованный ответ')}
            >
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Копировать расшифровку</span>
            </button>
          </div>

          <div className="split-editor">
            <textarea
              className="input textarea-code"
              rows={4}
              aria-label="Ответ с метками для расшифровки"
              placeholder="Вставьте текст с метками [ТЕЛЕФОН_1], [ИНН_1]..."
              value={aiReplyText}
              onChange={(e) => setAiReplyText(e.target.value)}
            />
            <textarea
              className="input textarea-code"
              rows={4}
              readOnly
              aria-label="Восстановленный текст"
              placeholder="Восстановленный текст с реальными данными..."
              value={restoredText}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
