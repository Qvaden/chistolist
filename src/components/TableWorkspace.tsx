import {
  BookmarkPlus,
  Download,
  FileSpreadsheet,
  Filter,
  Lock,
  PhoneCall,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type CleanOptions,
  type ParsedTable,
  cleanSpreadsheet,
  exportCleanFile,
  generateSampleSpreadsheet,
  parseSpreadsheet,
} from '../lib/csvEngine'
import {
  type SavedCsvRecipe,
  deleteCsvRecipe,
  getSavedCsvRecipes,
  saveCsvRecipe,
} from '../lib/license'

interface TableWorkspaceProps {
  onNotify: (message: string) => void
  incomingFiles?: { id: number; files: File[] } | null
}

const DEFAULT_OPTIONS: CleanOptions = {
  trimAndCollapse: true,
  removeEmptyRows: true,
  deduplicate: true,
  dedupeColumn: '__all__',
  normalizePhones: true,
  phoneColumn: '__auto__',
  phoneFormat: 'digits',
  normalizeEmails: true,
  splitFio: false,
  fioColumn: '__auto__',
}

export function TableWorkspace({ onNotify, incomingFiles }: TableWorkspaceProps) {
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [options, setOptions] = useState<CleanOptions>(DEFAULT_OPTIONS)
  const [isDragOver, setIsDragOver] = useState(false)
  const [recipes, setRecipes] = useState<SavedCsvRecipe[]>(() => getSavedCsvRecipes())
  const [recipeName, setRecipeName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastIncomingIdRef = useRef<number>(0)

  const result = useMemo(() => {
    if (!table) return null
    return cleanSpreadsheet(table, options)
  }, [table, options])

  const filteredRows = useMemo(() => {
    if (!result) return []
    const q = searchQuery.trim().toLowerCase()
    const indexed = result.rows.map((row, rIdx) => ({ row, rIdx }))
    return indexed
      .filter(({ row, rIdx }) => {
        if (onlyChanged) {
          const hasChange = row.some((_, cIdx) => result.changedCells.has(`${rIdx}:${cIdx}`))
          if (!hasChange) return false
        }
        if (q) {
          return row.some((cell) => cell.toLowerCase().includes(q))
        }
        return true
      })
      .slice(0, 100)
  }, [result, searchQuery, onlyChanged])

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const parsed = await parseSpreadsheet(file)
        setTable(parsed)
        setOptions((prev) => ({
          ...prev,
          dedupeColumn: '__all__',
          phoneColumn: '__auto__',
          fioColumn: '__auto__',
        }))
        setSearchQuery('')
        setOnlyChanged(false)
        onNotify(`Загружена таблица «${parsed.fileName}» (${parsed.rows.length} строк)`)
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Не удалось прочитать файл.')
      }
    },
    [onNotify]
  )

  useEffect(() => {
    if (!incomingFiles || incomingFiles.id === lastIncomingIdRef.current) return
    lastIncomingIdRef.current = incomingFiles.id
    const first = incomingFiles.files[0]
    if (first) void handleFile(first)
  }, [incomingFiles, handleFile])

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const loadSample = () => {
    const sample = generateSampleSpreadsheet()
    setTable(sample)
    setOptions((prev) => ({
      ...prev,
      dedupeColumn: '__all__',
      phoneColumn: '__auto__',
      fioColumn: '__auto__',
    }))
    setSearchQuery('')
    setOnlyChanged(false)
    onNotify('Загружена демо-выгрузка CRM (96 строк с дублями и разными форматами)')
  }

  const handleSaveRecipe = () => {
    const name = recipeName.trim() || `Рецепт ${recipes.length + 1}`
    const next = saveCsvRecipe({
      id: `${Date.now()}`,
      name,
      trimAndCollapse: options.trimAndCollapse,
      removeEmptyRows: options.removeEmptyRows,
      deduplicate: options.deduplicate,
      dedupeColumn: options.dedupeColumn,
      normalizePhones: options.normalizePhones,
      phoneFormat: options.phoneFormat,
      normalizeEmails: options.normalizeEmails,
      splitFio: options.splitFio,
    })
    setRecipes(next)
    setRecipeName('')
    onNotify(`Рецепт «${name}» сохранён локально`)
  }

  const applyRecipe = (r: SavedCsvRecipe) => {
    setOptions((prev) => ({
      ...prev,
      trimAndCollapse: r.trimAndCollapse,
      removeEmptyRows: r.removeEmptyRows,
      deduplicate: r.deduplicate,
      dedupeColumn:
        r.dedupeColumn === '__all__' || table?.headers.includes(r.dedupeColumn)
          ? r.dedupeColumn
          : '__all__',
      normalizePhones: r.normalizePhones,
      phoneFormat: r.phoneFormat,
      normalizeEmails: r.normalizeEmails,
      splitFio: r.splitFio,
    }))
    onNotify(`Применён рецепт «${r.name}»`)
  }

  if (!table || !result) {
    return (
      <div className="panel-inner">
        <div className="dropzone-shell">
          <div
            className={`dropzone ${isDragOver ? 'is-dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon" aria-hidden="true">
              <FileSpreadsheet size={24} />
            </div>
            <h2 className="dropzone-title">Очистка Excel и CSV прямо в браузере</h2>
            <p className="dropzone-desc">
              Перетащите выгрузку из 1С, CRM или маркетплейса. Сервис удалит дубликаты, приведёт
              телефоны к единому формату и уберёт мусорные символы — без отправки базы на сервер.
            </p>
            <div className="dropzone-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" />
                <span>Выбрать .xlsx или .csv</span>
              </button>
              <button type="button" className="btn" onClick={loadSample}>
                <Sparkles size={16} aria-hidden="true" />
                <span>Загрузить демо-таблицу</span>
              </button>
            </div>
          </div>

          <div className="capability-grid">
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <Lock size={17} />
              </div>
              <div>
                <h3 className="capability-title">Ноль байт на сервер</h3>
                <p className="capability-text">
                  Клиентские базы с телефонами и чеками обрабатываются локально в памяти вкладки.
                </p>
              </div>
            </div>
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <PhoneCall size={17} />
              </div>
              <div>
                <h3 className="capability-title">Нормализация номеров</h3>
                <p className="capability-text">
                  Автоматически приводит +7, 8 и 9XX к формату 79991234567 или +7 (999) 123-45-67.
                </p>
              </div>
            </div>
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <Filter size={17} />
              </div>
              <div>
                <h3 className="capability-title">Умная дедупликация</h3>
                <p className="capability-text">
                  Удаляет повторяющиеся контакты по всей строке или выбранной колонке и чистит пробелы.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <div className="metrics-strip">
        <div className="metric-box">
          <div className="metric-label">Исходно строк</div>
          <div className="metric-value tabular">{result.stats.originalRows}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">После очистки</div>
          <div className="metric-value tabular is-secure">{result.stats.finalRows}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Удалено дублей и пустых</div>
          <div className="metric-value tabular">
            {result.stats.removedDuplicates + result.stats.removedEmpty}
          </div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Исправлено ячеек</div>
          <div className="metric-value tabular">{result.stats.cleanedCells}</div>
        </div>
      </div>

      <div className="workbench">
        <aside className="card" aria-label="Правила очистки">
          <div className="card-header">
            <h2 className="card-title">Правила очистки</h2>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setTable(null)
                setOptions(DEFAULT_OPTIONS)
                setSearchQuery('')
                setOnlyChanged(false)
              }}
              title="Закрыть текущий файл"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Другой файл</span>
            </button>
          </div>

          <div className="control-group">
            <label className="toggle-row">
              <span>
                <span className="toggle-label">Убрать лишние пробелы</span>
                <span className="toggle-hint">Обрезка краёв и скрытых символов</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.trimAndCollapse}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, trimAndCollapse: e.target.checked }))
                }
              />
            </label>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Удалить пустые строки</span>
                <span className="toggle-hint">Пустые разделители из 1С и Excel</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.removeEmptyRows}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, removeEmptyRows: e.target.checked }))
                }
              />
            </label>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Удалить дубликаты</span>
                <span className="toggle-hint">Оставляет первое вхождение</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.deduplicate}
                onChange={(e) => setOptions((o) => ({ ...o, deduplicate: e.target.checked }))}
              />
            </label>

            {options.deduplicate && (
              <label className="field-label">
                <span>Проверять дубли по колонке</span>
                <select
                  className="select"
                  value={options.dedupeColumn}
                  onChange={(e) => setOptions((o) => ({ ...o, dedupeColumn: e.target.value }))}
                >
                  <option value="__all__">Вся строка целиком</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Нормализовать телефоны РФ</span>
                <span className="toggle-hint">+7, 8, 9XX к единому виду</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.normalizePhones}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, normalizePhones: e.target.checked }))
                }
              />
            </label>

            {options.normalizePhones && (
              <>
                <label className="field-label">
                  <span>Колонка с телефоном</span>
                  <select
                    className="select"
                    value={options.phoneColumn}
                    onChange={(e) => setOptions((o) => ({ ...o, phoneColumn: e.target.value }))}
                  >
                    <option value="__auto__">Автоопределение</option>
                    {table.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  <span>Формат телефона</span>
                  <select
                    className="select"
                    value={options.phoneFormat}
                    onChange={(e) =>
                      setOptions((o) => ({
                        ...o,
                        phoneFormat: e.target.value as 'digits' | 'formatted',
                      }))
                    }
                  >
                    <option value="digits">79991234567 (для CRM/рекламы)</option>
                    <option value="formatted">+7 (999) 123-45-67 (читаемый)</option>
                  </select>
                </label>
              </>
            )}

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Email в нижний регистр</span>
                <span className="toggle-hint">Убирает заглавные буквы и пробелы</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.normalizeEmails}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, normalizeEmails: e.target.checked }))
                }
              />
            </label>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Разбить ФИО на 3 колонки</span>
                <span className="toggle-hint">Фамилия, Имя, Отчество</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.splitFio}
                onChange={(e) => setOptions((o) => ({ ...o, splitFio: e.target.checked }))}
              />
            </label>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '16px 0' }} />

          <div className="card-header" style={{ marginBottom: '10px' }}>
            <h3 className="card-title">Сохранённые рецепты</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="text"
              className="input"
              placeholder="Название рецепта"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleSaveRecipe}
              title="Сохранить текущий набор правил"
              aria-label="Сохранить рецепт"
            >
              <BookmarkPlus size={15} aria-hidden="true" />
            </button>
          </div>

          {recipes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recipes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '6px 10px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                  }}
                >
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 0,
                      padding: 0,
                      textAlign: 'left',
                      flex: 1,
                    }}
                    onClick={() => applyRecipe(r)}
                  >
                    {r.name}
                  </button>
                  <button
                    type="button"
                    style={{ background: 'none', border: 0, padding: '2px', color: 'var(--ink-muted)' }}
                    aria-label={`Удалить рецепт ${r.name}`}
                    onClick={() => setRecipes(deleteCsvRecipe(r.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="card" aria-label="Результат обработки">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2 className="card-title">{table.fileName}</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                Показаны {filteredRows.length} из {result.rows.length} строк (зелёным — исправленные
                ячейки)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  exportCleanFile(result.headers, result.rows, 'xlsx', table.fileName)
                  onNotify('Файл .xlsx сохранён на ваше устройство')
                }}
              >
                <Download size={16} aria-hidden="true" />
                <span>Скачать .xlsx</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  exportCleanFile(result.headers, result.rows, 'csv', table.fileName)
                  onNotify('Файл .csv (UTF-8) сохранён на ваше устройство')
                }}
              >
                <Download size={16} aria-hidden="true" />
                <span>Скачать .csv</span>
              </button>
            </div>
          </div>

          <div className="table-toolbar">
            <div className="search-box">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                className="input"
                placeholder="Поиск по таблице..."
                aria-label="Поиск по таблице"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
              />
              <span>Только изменённые</span>
            </label>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Предпросмотр очищенной таблицы"
            className="table-wrapper"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {result.headers.map((h, colIdx) => (
                    <th key={`${h}-${colIdx}`} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ row, rIdx }) => (
                  <tr key={rIdx}>
                    <th scope="row" className="tabular">
                      {rIdx + 1}
                    </th>
                    {row.map((cell, cIdx) => {
                      const isChanged = result.changedCells.has(`${rIdx}:${cIdx}`)
                      return (
                        <td
                          key={cIdx}
                          data-label={result.headers[cIdx] ?? `Колонка ${cIdx + 1}`}
                          className={isChanged ? 'cell-changed' : undefined}
                          title={cell}
                        >
                          {cell || '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
