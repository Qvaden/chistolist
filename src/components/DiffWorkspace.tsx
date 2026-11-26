import { ArrowLeftRight, Eraser, GitCompare, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  SAMPLE_DIFF_LEFT,
  SAMPLE_DIFF_RIGHT,
  computeTextDiff,
} from '../lib/diffEngine'

interface DiffWorkspaceProps {
  onNotify: (message: string) => void
}

export function DiffWorkspace({ onNotify }: DiffWorkspaceProps) {
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [onlyChanges, setOnlyChanges] = useState(false)

  const diff = useMemo(() => {
    if (!leftText && !rightText) return null
    return computeTextDiff(leftText, rightText)
  }, [leftText, rightText])

  const visibleLines = useMemo(() => {
    if (!diff) return []
    return onlyChanges ? diff.lines.filter((l) => l.kind !== 'equal') : diff.lines
  }, [diff, onlyChanges])

  return (
    <div className="panel-inner">
      {diff && (
        <div className="metrics-strip">
          <div className="metric-box">
            <div className="metric-label">Совпадение текста</div>
            <div className="metric-value tabular is-secure">
              {diff.stats.similarityPercent}%
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-label">Добавлено слов</div>
            <div className="metric-value tabular" style={{ color: 'var(--signal-secure)' }}>
              +{diff.stats.addedWords}
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-label">Удалено слов</div>
            <div className="metric-value tabular" style={{ color: 'var(--signal-danger)' }}>
              -{diff.stats.removedWords}
            </div>
          </div>
          <div className="metric-box">
            <div className="metric-label">Изменённых строк</div>
            <div className="metric-value tabular">{diff.stats.changedLines}</div>
          </div>
        </div>
      )}

      <section className="card" aria-label="Сравнение двух редакций">
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCompare size={17} aria-hidden="true" />
              <span>Поиск скрытых правок в договорах и текстах</span>
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
              Сравнивает две версии построчно и пословно прямо в браузере
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setLeftText(SAMPLE_DIFF_LEFT)
                setRightText(SAMPLE_DIFF_RIGHT)
                onNotify('Загружены две редакции договора — все правки подсвечены ниже')
              }}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>Загрузить демо-договор</span>
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!leftText && !rightText}
              onClick={() => {
                setLeftText(rightText)
                setRightText(leftText)
              }}
            >
              <ArrowLeftRight size={14} aria-hidden="true" />
              <span>Поменять местами</span>
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!leftText && !rightText}
              onClick={() => {
                setLeftText('')
                setRightText('')
              }}
            >
              <Eraser size={14} aria-hidden="true" />
              <span>Очистить</span>
            </button>
          </div>
        </div>

        <div className="split-editor">
          <label className="field-label">
            <span>Исходная редакция (было)</span>
            <textarea
              className="input textarea-code"
              rows={7}
              placeholder="Вставьте исходный текст договора..."
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
            />
          </label>
          <label className="field-label">
            <span>Новая редакция (стало)</span>
            <textarea
              className="input textarea-code"
              rows={7}
              placeholder="Вставьте присланную версию с правками..."
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
            />
          </label>
        </div>
      </section>

      {diff && (
        <section className="card" aria-label="Результат сравнения">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <h3 className="card-title">Подсветка изменений</h3>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                color: 'var(--ink-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                className="switch-input"
                checked={onlyChanges}
                onChange={(e) => setOnlyChanges(e.target.checked)}
              />
              <span>Только изменённые строки</span>
            </label>
          </div>

          <div className="diff-view" role="region" aria-label="Отличия по строкам">
            {visibleLines.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--ink-secondary)', fontSize: '0.88rem' }}>
                Отличий не найдено — тексты полностью совпадают.
              </div>
            ) : (
              visibleLines.map((line, idx) => (
                <div key={idx} className={`diff-line is-${line.kind}`}>
                  <span className="diff-ln tabular">
                    {line.leftLineNumber ?? '·'} / {line.rightLineNumber ?? '·'}
                  </span>
                  <span className="diff-content">
                    {line.tokens.map((tok, tIdx) => {
                      if (tok.type === 'added') {
                        return (
                          <ins key={tIdx} className="diff-add">
                            {tok.value}
                          </ins>
                        )
                      }
                      if (tok.type === 'removed') {
                        return (
                          <del key={tIdx} className="diff-del">
                            {tok.value}
                          </del>
                        )
                      }
                      return <span key={tIdx}>{tok.value}</span>
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
