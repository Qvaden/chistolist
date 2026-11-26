import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileDown,
  FilePlus2,
  Image as ImageIcon,
  MapPin,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  type ImageItem,
  type ImageProcessOptions,
  downloadBlob,
  exportImagesAsPdf,
  formatBytes,
  generateSamplePhotoWithExif,
  loadImageItems,
  processImageItem,
} from '../lib/imageEngine'
import { downloadPdfBytes } from '../lib/pdfEngine'

interface PhotoWorkspaceProps {
  onNotify: (message: string) => void
  incomingFiles?: { id: number; files: File[] } | null
  isActive?: boolean
}

const QUICK_WATERMARKS = ['КОПИЯ ДЛЯ БАНКА', 'КОНФИДЕНЦИАЛЬНО']

export function PhotoWorkspace({
  onNotify,
  incomingFiles,
  isActive = false,
}: PhotoWorkspaceProps) {
  const [items, setItems] = useState<ImageItem[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [options, setOptions] = useState<ImageProcessOptions>({
    format: 'image/jpeg',
    quality: 0.84,
    maxDimension: 2000,
    watermarkEnabled: false,
    watermarkText: 'КОПИЯ ДЛЯ БАНКА',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const lastIncomingIdRef = useRef<number>(0)
  const itemsRef = useRef<ImageItem[]>([])
  itemsRef.current = items

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.previewUrl)
      }
    }
  }, [])

  const handleFiles = useCallback(
    async (fileList: FileList | File[], append = false) => {
      const loaded = await loadImageItems(fileList)
      if (loaded.length === 0) {
        onNotify('Выберите изображения в формате JPG, PNG или WebP.')
        return
      }
      setItems((prev) => {
        if (!append) {
          for (const old of prev) URL.revokeObjectURL(old.previewUrl)
          return loaded
        }
        return [...prev, ...loaded]
      })

      const withExif = loaded.filter((i) => i.exif.hasGps || i.exif.tagCount > 0).length
      if (withExif > 0) {
        onNotify(`Загружено фото: ${loaded.length} (найдены скрытые EXIF/GPS в ${withExif})`)
      } else {
        onNotify(`Загружено фото: ${loaded.length}`)
      }
    },
    [onNotify]
  )

  useEffect(() => {
    if (!incomingFiles || incomingFiles.id === lastIncomingIdRef.current) return
    lastIncomingIdRef.current = incomingFiles.id
    void handleFiles(incomingFiles.files, false)
  }, [incomingFiles, handleFiles])

  useEffect(() => {
    if (!isActive) return
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith('image/')
      )
      if (files.length > 0) {
        e.preventDefault()
        void handleFiles(files, itemsRef.current.length > 0)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [isActive, handleFiles])

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      void handleFiles(e.dataTransfer.files, false)
    }
  }

  const loadSample = async () => {
    try {
      const sample = await generateSamplePhotoWithExif()
      await handleFiles([sample], false)
    } catch {
      onNotify('Не удалось создать демо-скан.')
    }
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(idx, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const removeItem = (idx: number) => {
    setItems((prev) => {
      const target = prev[idx]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const clearAll = () => {
    for (const it of items) URL.revokeObjectURL(it.previewUrl)
    setItems([])
  }

  const extForFormat = (fmt: ImageProcessOptions['format']) =>
    fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'

  const handleDownloadSingle = async (item: ImageItem) => {
    setIsBusy(true)
    try {
      const { blob } = await processImageItem(item, options)
      const base = item.name.replace(/\.[^.]+$/, '') || 'photo'
      downloadBlob(blob, `${base}_clean.${extForFormat(options.format)}`)
      onNotify(`Файл «${base}_clean.${extForFormat(options.format)}» очищен от EXIF и сохранён`)
    } catch {
      onNotify('Не удалось обработать изображение.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleDownloadAll = async () => {
    if (items.length === 0) return
    setIsBusy(true)
    try {
      const ext = extForFormat(options.format)
      for (const item of items) {
        const { blob } = await processImageItem(item, options)
        const base = item.name.replace(/\.[^.]+$/, '') || 'photo'
        downloadBlob(blob, `${base}_clean.${ext}`)
      }
      onNotify(`Готово! Очищено и сохранено фото: ${items.length}`)
    } catch {
      onNotify('Ошибка при пакетной обработке фото.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleExportPdf = async () => {
    if (items.length === 0) return
    setIsBusy(true)
    try {
      const bytes = await exportImagesAsPdf(items, options)
      downloadPdfBytes(bytes, 'chistolist_scans.pdf')
      onNotify(`Собран PDF из ${items.length} стр. (EXIF и GPS полностью удалены)`)
    } catch {
      onNotify('Ошибка при сборке PDF из изображений.')
    } finally {
      setIsBusy(false)
    }
  }

  if (items.length === 0) {
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
              <ImageIcon size={24} />
            </div>
            <h2 className="dropzone-title">Удаление EXIF, сжатие и сборка сканов в PDF</h2>
            <p className="dropzone-desc">
              Перед отправкой фото паспорта, товара или квартиры в интернет — сотрите скрытые
              координаты GPS и модель телефона, уменьшите вес и соберите несколько снимков в один PDF.
            </p>
            <div className="dropzone-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
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
                <span>Выбрать фото или сканы</span>
              </button>
              <button type="button" className="btn" onClick={() => void loadSample()}>
                <Sparkles size={16} aria-hidden="true" />
                <span>Загрузить демо-скан с EXIF</span>
              </button>
            </div>
          </div>

          <div className="capability-grid">
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <MapPin size={17} />
              </div>
              <div>
                <h3 className="capability-title">Удаление EXIF и GPS</h3>
                <p className="capability-text">
                  Показывает, какие координаты и данные устройства зашиты в фото, и стирает их.
                </p>
              </div>
            </div>
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <Minimize2 size={17} />
              </div>
              <div>
                <h3 className="capability-title">Сжатие и конвертация</h3>
                <p className="capability-text">
                  Уменьшает разрешение и вес снимков в WebP/JPEG без потери читаемости текста.
                </p>
              </div>
            </div>
            <div className="capability-card">
              <div className="capability-icon" aria-hidden="true">
                <FileDown size={17} />
              </div>
              <div>
                <h3 className="capability-title">Сканы в один PDF</h3>
                <p className="capability-text">
                  Собирает пачку фотографий документов в аккуратный многостраничный PDF в 1 клик.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalBytes = items.reduce((acc, it) => acc + it.sizeBytes, 0)
  const exifFoundCount = items.filter((it) => it.exif.hasGps || it.exif.tagCount > 0).length
  const gpsFoundCount = items.filter((it) => it.exif.hasGps).length

  return (
    <div className="panel-inner">
      <div className="metrics-strip">
        <div className="metric-box">
          <div className="metric-label">Загружено фото</div>
          <div className="metric-value tabular">{items.length}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Скрытые EXIF / GPS</div>
          <div
            className="metric-value tabular"
            style={{ color: exifFoundCount > 0 ? 'var(--signal-pro)' : 'var(--signal-secure)' }}
          >
            {exifFoundCount > 0 ? `${exifFoundCount} (${gpsFoundCount} GPS)` : '0'}
          </div>
        </div>
        <div className="metric-box">
          <div className="metric-label">Исходный размер</div>
          <div className="metric-value tabular">{formatBytes(totalBytes)}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">После экспорта</div>
          <div className="metric-value tabular is-secure">0 EXIF</div>
        </div>
      </div>

      <div className="workbench">
        <aside className="card" aria-label="Настройки очистки фото">
          <div className="card-header">
            <h2 className="card-title">Очистка и экспорт</h2>
            <button type="button" className="btn btn-sm" onClick={clearAll}>
              <RotateCcw size={14} aria-hidden="true" />
              <span>Сбросить</span>
            </button>
          </div>

          <div className="control-group">
            <label className="field-label">
              <span>Формат на выходе</span>
              <select
                className="select"
                value={options.format}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    format: e.target.value as ImageProcessOptions['format'],
                  }))
                }
              >
                <option value="image/jpeg">JPEG (для документов и сайтов)</option>
                <option value="image/webp">WebP (минимальный вес)</option>
                <option value="image/png">PNG (без потерь)</option>
              </select>
            </label>

            {options.format !== 'image/png' && (
              <label className="field-label">
                <span>Качество сжатия ({Math.round(options.quality * 100)}%)</span>
                <input
                  type="range"
                  className="range-slider"
                  min="0.5"
                  max="0.95"
                  step="0.03"
                  value={options.quality}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, quality: Number(e.target.value) }))
                  }
                />
              </label>
            )}

            <label className="field-label">
              <span>Максимальная сторона</span>
              <select
                className="select"
                value={options.maxDimension}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, maxDimension: Number(e.target.value) }))
                }
              >
                <option value={0}>Оставить оригинал</option>
                <option value={2000}>До 2000 px (оптимально для сканов)</option>
                <option value={1600}>До 1600 px (для мессенджеров)</option>
                <option value={1200}>До 1200 px (лёгкий веб-размер)</option>
              </select>
            </label>

            <label className="toggle-row">
              <span>
                <span className="toggle-label">Водяной знак на фото</span>
                <span className="toggle-hint">Защита копии паспорта/чека</span>
              </span>
              <input
                type="checkbox"
                className="switch-input"
                checked={options.watermarkEnabled}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, watermarkEnabled: e.target.checked }))
                }
              />
            </label>

            {options.watermarkEnabled && (
              <>
                <label className="field-label">
                  <span>Текст водяного знака</span>
                  <input
                    type="text"
                    className="input"
                    value={options.watermarkText}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, watermarkText: e.target.value }))
                    }
                  />
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {QUICK_WATERMARKS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="chip-btn"
                      onClick={() => setOptions((o) => ({ ...o, watermarkText: text }))}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '6px' }}
              disabled={isBusy}
              onClick={() => void handleExportPdf()}
            >
              <FileDown size={16} aria-hidden="true" />
              <span>{isBusy ? 'Обработка...' : 'Собрать в один PDF'}</span>
            </button>

            <button
              type="button"
              className="btn"
              style={{ width: '100%' }}
              disabled={isBusy}
              onClick={() => void handleDownloadAll()}
            >
              <Download size={16} aria-hidden="true" />
              <span>Скачать очищенные ({items.length})</span>
            </button>
          </div>
        </aside>

        <section className="card" aria-label="Список изображений">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2 className="card-title">Очередь изображений ({items.length})</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                Перерисовка через Canvas физически удаляет все EXIF, GPS и серию камеры
              </span>
            </div>
            <input
              ref={addInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
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
              onClick={() => addInputRef.current?.click()}
            >
              <FilePlus2 size={14} aria-hidden="true" />
              <span>Добавить фото</span>
            </button>
          </div>

          <div className="photo-grid">
            {items.map((item, idx) => {
              const hasMeta = item.exif.hasGps || item.exif.tagCount > 0
              const metaDetails = [
                item.exif.gpsText ? `GPS: ${item.exif.gpsText}` : item.exif.hasGps ? 'GPS найден' : '',
                item.exif.model || item.exif.make || '',
                item.exif.dateTime || '',
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <article key={item.id} className="photo-card">
                  <div className="photo-thumb">
                    <img src={item.previewUrl} alt={item.name} />
                  </div>
                  <div className="photo-meta">
                    <div className="photo-name" title={item.name}>
                      {item.name}
                    </div>
                    <div className="photo-dims tabular">
                      {item.width}×{item.height} px · {formatBytes(item.sizeBytes)}
                    </div>
                    <div className={`exif-pill ${hasMeta ? 'is-warn' : 'is-clean'}`}>
                      {hasMeta ? (
                        <>
                          <MapPin size={12} aria-hidden="true" />
                          <span>{metaDetails || `Найдено тегов EXIF: ${item.exif.tagCount}`}</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={12} aria-hidden="true" />
                          <span>Скрытых метаданных нет</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="photo-actions">
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '4px 7px' }}
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        aria-label="Переместить раньше"
                      >
                        <ArrowLeft size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '4px 7px' }}
                        disabled={idx === items.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        aria-label="Переместить позже"
                      >
                        <ArrowRight size={13} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void handleDownloadSingle(item)}
                        aria-label={`Скачать очищенный ${item.name}`}
                      >
                        <Download size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeItem(idx)}
                        aria-label={`Удалить ${item.name}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
