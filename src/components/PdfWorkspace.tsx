import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Download,
  Eraser,
  EyeOff,
  FilePlus2,
  FileText,
  Hand,
  Layers,
  PenTool,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Stamp,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { type DragEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  type SavedWatermarkPreset,
  getSavedWatermarkPresets,
  saveWatermarkPreset,
} from '../lib/license'
import {
  type NormalizedRect,
  type PdfPageItem,
  type WatermarkConfig,
  downloadPdfBytes,
  exportProcessedPdf,
  generateSampleContractPdf,
  loadPdfPages,
  renderPdfPageToCanvas,
} from '../lib/pdfEngine'

interface PdfWorkspaceProps {
  onNotify: (message: string) => void
  incomingFiles?: { id: number; files: File[] } | null
}

const QUICK_WATERMARKS = ['КОПИЯ ДЛЯ БАНКА', 'КОНФИДЕНЦИАЛЬНО', 'НЕ ДЛЯ ПЕРЕДАЧИ']

export function PdfWorkspace({ onNotify, incomingFiles }: PdfWorkspaceProps) {
  const [pages, setPages] = useState<PdfPageItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [interactionMode, setInteractionMode] = useState<'redact' | 'scroll'>('redact')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [watermark, setWatermark] = useState<WatermarkConfig>({
    enabled: true,
    text: 'КОПИЯ ДЛЯ ОЗНАКОМЛЕНИЯ',
    opacity: 0.22,
    mode: 'center',
  })
  const [presets, setPresets] = useState<SavedWatermarkPreset[]>(() => getSavedWatermarkPresets())
  const [draftRect, setDraftRect] = useState<{
    startX: number
    startY: number
    curX: number
    curY: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addPdfInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastIncomingIdRef = useRef<number>(0)

  const activePage = pages[activeIndex] ?? null

  useEffect(() => {
    if (!activePage || !canvasRef.current) return
    let cancelled = false
    const render = async () => {
      if (!canvasRef.current || cancelled) return
      await renderPdfPageToCanvas(activePage, canvasRef.current, 660)
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [activePage])

  const undoLastRedaction = useCallback(() => {
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === activeIndex && p.redactions.length > 0
          ? { ...p, redactions: p.redactions.slice(0, -1) }
          : p
      )
    )
  }, [activeIndex])

  useEffect(() => {
    if (!activePage || activePage.redactions.length === 0) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        undoLastRedaction()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activePage, undoLastRedaction])

  const handleFiles = useCallback(
    async (fileList: FileList | File[], append = false) => {
      try {
        const loaded: PdfPageItem[] = []
        for (const file of Array.from(fileList)) {
          if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            const items = await loadPdfPages(file)
            loaded.push(...items)
          }
        }
        if (loaded.length === 0) {
          onNotify('Выберите один или несколько PDF-файлов.')
          return
        }
        setPages((prev) => (append ? [...prev, ...loaded] : loaded))
        if (!append) setActiveIndex(0)
        onNotify(`Загружено страниц: ${loaded.length}`)
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Не удалось открыть PDF.')
      }
    },
    [onNotify]
  )

  useEffect(() => {
    if (!incomingFiles || incomingFiles.id === lastIncomingIdRef.current) return
    lastIncomingIdRef.current = incomingFiles.id
    void handleFiles(incomingFiles.files, false)
  }, [incomingFiles, handleFiles])

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      void handleFiles(e.dataTransfer.files, false)
    }
  }

  const loadSample = async () => {
    try {
      const sampleFile = await generateSampleContractPdf()
      await handleFiles([sampleFile], false)
    } catch {
      onNotify('Не удалось создать демо-договор.')
    }
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (interactionMode === 'scroll') return
    if (!wrapRef.current || !activePage) return
    if ((e.target as HTMLElement).closest('[data-redaction-box="true"]')) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    wrapRef.current.setPointerCapture(e.pointerId)
    setDraftRect({ startX: x, startY: y, curX: x, curY: y })
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draftRect || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setDraftRect((prev) => (prev ? { ...prev, curX: x, curY: y } : null))
  }

  const handlePointerUp = () => {
    if (!draftRect || !activePage) return
    const x = Math.min(draftRect.startX, draftRect.curX)
    const y = Math.min(draftRect.startY, draftRect.curY)
    const w = Math.abs(draftRect.curX - draftRect.startX)
    const h = Math.abs(draftRect.curY - draftRect.startY)
    setDraftRect(null)

    if (w < 0.015 || h < 0.015) return

    const newBox: NormalizedRect = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      w,
      h,
    }
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === activeIndex ? { ...p, redactions: [...p.redactions, newBox] } : p
      )
    )
  }

  const removeRedaction = (boxId: string) => {
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === activeIndex
          ? { ...p, redactions: p.redactions.filter((r) => r.id !== boxId) }
          : p
      )
    )
  }

  const movePage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= pages.length) return
    setPages((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(target, 0, item)
      return copy
    })
    if (activeIndex === idx) setActiveIndex(target)
  }

  const deletePage = (idx: number) => {
    setPages((prev) => prev.filter((_, i) => i !== idx))
    if (activeIndex >= pages.length - 1) {
      setActiveIndex(Math.max(0, pages.length - 2))
    }
  }

  const handleExport = async () => {
    if (pages.length === 0) return
    setIsExporting(true)
    try {
      const res = await exportProcessedPdf(pages, watermark)
      const base = pages[0].sourceName.replace(/\.pdf$/i, '') || 'document'
      downloadPdfBytes(res.bytes, `${base}_protected.pdf`)
      onNotify(`Готово! Защищённый PDF (${res.exportedPages} стр.) сохранён локально.`)
    } catch {
      onNotify('Ошибка при сборке PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleSaveWatermarkPreset = () => {
    const text = watermark.text.trim()
    if (!text) return
    const next = saveWatermarkPreset({
      id: `${Date.now()}`,
      name: text.slice(0, 26),
      text,
      opacity: watermark.opacity,
      mode: watermark.mode,
    })
    setPresets(next)
    onNotify('Шаблон водяного знака сохранён')
  }

  if (pages.length === 0 || !activePage) {
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
              <FileText size={24} />
            </div>
            <h2 className="dropzone-title">Защита и склейка PDF без загрузки на сервер</h2>
            <p className="dropzone-desc">
              Надёжно замазывайте паспортные данные, ИНН и суммы в договорах, ставьте водяной знак
              «Копия для…» и объединяйте страницы. Всё рендерится локально на вашем устройстве.
            </p>
            <div className="dropzone-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) void handleFiles(e.target.files, false)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" />
                <span>Выбрать PDF</span>
              </button>
              <button type="button" className="btn" onClick={() => void loadSample()}>
                <Sparkles size={16} aria-hidden="true" />
                <span>Загрузить демо-договор</span>
              </button>
            </div>
          </div>

          <div className="capability-grid">
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <EyeOff size={17} />
              </div>
              <div>
                <h3 className="capability-title">Физическое замазывание</h3>
                <p className="capability-text">
                  Закрытые области перерисовываются в растр — текст нельзя выделить или вытащить.
                </p>
              </div>
            </div>
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <Stamp size={17} />
              </div>
              <div>
                <h3 className="capability-title">Водяные знаки</h3>
                <p className="capability-text">
                  Быстрый штамп «Копия для банка» по центру или сеткой с живым предпросмотром.
                </p>
              </div>
            </div>
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <Layers size={17} />
              </div>
              <div>
                <h3 className="capability-title">Склейка и порядок</h3>
                <p className="capability-text">
                  Объединяйте несколько PDF, меняйте порядок страниц и удаляйте лишние листы.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const draftBoxStyle = draftRect
    ? {
        left: `${Math.min(draftRect.startX, draftRect.curX) * 100}%`,
        top: `${Math.min(draftRect.startY, draftRect.curY) * 100}%`,
        width: `${Math.abs(draftRect.curX - draftRect.startX) * 100}%`,
        height: `${Math.abs(draftRect.curY - draftRect.startY) * 100}%`,
      }
    : null

  return (
    <div className="panel-inner">
      <div className="pdf-studio">
        <aside className="card" aria-label="Страницы документа">
          <div className="card-header">
            <h2 className="card-title">Страницы ({pages.length})</h2>
          </div>
          <div className="thumb-rail">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className={`thumb-item ${idx === activeIndex ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className="thumb-img-btn"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Открыть страницу ${idx + 1}`}
                >
                  <img src={p.thumbUrl} alt={`Миниатюра страницы ${idx + 1}`} />
                </button>
                <div className="thumb-controls">
                  <span className="tabular">
                    Стр. {idx + 1}
                    {p.redactions.length > 0 ? ` (${p.redactions.length})` : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ padding: '3px 5px' }}
                      disabled={idx === 0}
                      onClick={() => movePage(idx, -1)}
                      aria-label="Переместить выше"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ padding: '3px 5px' }}
                      disabled={idx === pages.length - 1}
                      onClick={() => movePage(idx, 1)}
                      aria-label="Переместить ниже"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ padding: '3px 5px' }}
                      disabled={pages.length === 1}
                      onClick={() => deletePage(idx)}
                      aria-label="Удалить страницу"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <input
            ref={addPdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files, true)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn btn-sm"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={() => addPdfInputRef.current?.click()}
          >
            <FilePlus2 size={14} aria-hidden="true" />
            <span>Добавить PDF для склейки</span>
          </button>
        </aside>

        <section className="stage-card" aria-label="Область редактирования страницы">
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div className="mode-switch" role="group" aria-label="Режим касания">
              <button
                type="button"
                className="mode-switch-btn"
                aria-pressed={interactionMode === 'redact'}
                onClick={() => setInteractionMode('redact')}
              >
                <PenTool size={14} aria-hidden="true" />
                <span>Замазывание</span>
              </button>
              <button
                type="button"
                className="mode-switch-btn"
                aria-pressed={interactionMode === 'scroll'}
                onClick={() => setInteractionMode('scroll')}
              >
                <Hand size={14} aria-hidden="true" />
                <span>Прокрутка</span>
              </button>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setPages([])
                setActiveIndex(0)
              }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          </div>

          <div
            ref={wrapRef}
            className={`pdf-canvas-wrap ${interactionMode === 'scroll' ? 'is-scroll-mode' : ''}`}
            style={{
              backgroundColor: '#ffffff',
              aspectRatio: `${activePage.widthPt} / ${activePage.heightPt}`,
              width: 'min(660px, 100%)',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <canvas ref={canvasRef} />

            {watermark.enabled && watermark.text.trim() && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {watermark.mode === 'center' ? (
                  <span
                    style={{
                      color: `rgba(180, 35, 35, ${watermark.opacity})`,
                      fontWeight: 700,
                      fontSize: 'clamp(16px, 3vw, 28px)',
                      transform: 'rotate(-30deg)',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                    }}
                  >
                    {watermark.text}
                  </span>
                ) : (
                  <svg
                    width="100%"
                    height="100%"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    <defs>
                      <pattern
                        id="pdf-wm-tile"
                        width={Math.max(210, watermark.text.length * 12 + 56)}
                        height="115"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(-30)"
                      >
                        <text
                          x="50%"
                          y="50%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={`rgba(180, 35, 35, ${watermark.opacity})`}
                          fontFamily="Manrope, sans-serif"
                          fontWeight="600"
                          fontSize="15"
                        >
                          {watermark.text}
                        </text>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#pdf-wm-tile)" />
                  </svg>
                )}
              </div>
            )}

            {activePage.redactions.map((box) => (
              <div
                key={box.id}
                data-redaction-box="true"
                className="redaction-box"
                title="Нажмите, чтобы удалить блок замазывания"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`,
                  height: `${box.h * 100}%`,
                }}
                onClick={() => removeRedaction(box.id)}
              >
                <button
                  type="button"
                  className="redaction-remove"
                  aria-label="Удалить область замазывания"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeRedaction(box.id)
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {draftBoxStyle && <div className="redaction-box-draft" style={draftBoxStyle} />}
          </div>
        </section>

        <aside className="card" aria-label="Настройки защиты PDF">
          <div className="card-header">
            <h2 className="card-title">Защита и экспорт</h2>
          </div>

          <div className="control-group">
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <ShieldAlert size={15} color="var(--signal-danger)" aria-hidden="true" />
                <span>Замазано областей: {activePage.redactions.length}</span>
              </div>
              <span style={{ color: 'var(--ink-secondary)' }}>
                При сохранении страницы с чёрными блоками перерисовываются в растр — исходный текст
                удаляется физически.
              </span>
              {activePage.redactions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ flex: 1 }}
                    onClick={undoLastRedaction}
                  >
                    <Undo2 size={14} aria-hidden="true" />
                    <span>Отменить</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    style={{ flex: 1 }}
                    onClick={() =>
                      setPages((prev) =>
                        prev.map((p, idx) =>
                          idx === activeIndex ? { ...p, redactions: [] } : p
                        )
                      )
                    }
                  >
                    <Eraser size={14} aria-hidden="true" />
                    <span>Очистить</span>
                  </button>
                </div>
              )}
            </div>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Водяной знак</span>
                <span className="toggle-hint">Защита скана от пересылки третьим лицам</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={watermark.enabled}
                onChange={(e) => setWatermark((w) => ({ ...w, enabled: e.target.checked }))}
              />
            </label>

            {watermark.enabled && (
              <>
                <label className="field-label">
                  <span>Текст водяного знака</span>
                  <input
                    type="text"
                    className="input"
                    value={watermark.text}
                    onChange={(e) => setWatermark((w) => ({ ...w, text: e.target.value }))}
                  />
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {QUICK_WATERMARKS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="chip-btn"
                      onClick={() => setWatermark((w) => ({ ...w, text }))}
                    >
                      {text}
                    </button>
                  ))}
                </div>

                <label className="field-label">
                  <span>Расположение</span>
                  <select
                    className="select"
                    value={watermark.mode}
                    onChange={(e) =>
                      setWatermark((w) => ({
                        ...w,
                        mode: e.target.value as 'center' | 'tiled',
                      }))
                    }
                  >
                    <option value="center">Крупно по центру</option>
                    <option value="tiled">Сеткой по всему листу</option>
                  </select>
                </label>

                <label className="field-label">
                  <span>Прозрачность ({Math.round(watermark.opacity * 100)}%)</span>
                  <input
                    type="range"
                    className="range-slider"
                    min="0.08"
                    max="0.55"
                    step="0.02"
                    value={watermark.opacity}
                    onChange={(e) =>
                      setWatermark((w) => ({ ...w, opacity: Number(e.target.value) }))
                    }
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                    Мои шаблоны
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleSaveWatermarkPreset}
                    title="Сохранить шаблон водяного знака"
                  >
                    <BookmarkPlus size={14} aria-hidden="true" />
                    <span>Сохранить</span>
                  </button>
                </div>

                {presets.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {presets.map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setWatermark({
                            enabled: true,
                            text: pr.text,
                            opacity: pr.opacity,
                            mode: pr.mode,
                          })
                        }
                      >
                        {pr.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={isExporting}
              onClick={() => void handleExport()}
            >
              <Download size={16} aria-hidden="true" />
              <span>{isExporting ? 'Сборка PDF...' : 'Скачать готовый PDF'}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
