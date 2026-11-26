import { useCallback, useEffect, useRef, useState } from 'react'
import { AnonymizerWorkspace } from './components/AnonymizerWorkspace'
import { DiffWorkspace } from './components/DiffWorkspace'
import { Header, type WorkspaceTab } from './components/Header'
import { PdfWorkspace } from './components/PdfWorkspace'
import { PhotoWorkspace } from './components/PhotoWorkspace'
import { TableWorkspace } from './components/TableWorkspace'
import { type ToastMessage, ToastRegion } from './components/ToastRegion'

export interface IncomingFilesPayload {
  id: number
  files: File[]
}

const THEME_STORAGE_KEY = 'chistolist_theme'

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // ignore
  }
  return 'dark'
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tables')
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [isGlobalDragging, setIsGlobalDragging] = useState(false)
  const [tableIncoming, setTableIncoming] = useState<IncomingFilesPayload | null>(null)
  const [pdfIncoming, setPdfIncoming] = useState<IncomingFilesPayload | null>(null)
  const [photoIncoming, setPhotoIncoming] = useState<IncomingFilesPayload | null>(null)
  const dragCounterRef = useRef(0)

  const notify = useCallback((text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev.slice(-2), { id, text }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#F3F6FB' : '#090D16')
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])

  // Alt+1..5 quick tab shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const map: Record<string, WorkspaceTab> = {
        '1': 'tables',
        '2': 'pdf',
        '3': 'photos',
        '4': 'anonymizer',
        '5': 'diff',
      }
      const next = map[e.key]
      if (next) {
        e.preventDefault()
        setActiveTab(next)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Smart global drag-and-drop router
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files'))

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragCounterRef.current++
      setIsGlobalDragging(true)
    }

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
    }

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) {
        setIsGlobalDragging(false)
      }
    }

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragCounterRef.current = 0
      setIsGlobalDragging(false)

      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return

      const first = files[0]
      const name = first.name.toLowerCase()
      const payloadId = Date.now()

      if (/\.(xlsx|xls|csv)$/i.test(name)) {
        setActiveTab('tables')
        setTableIncoming({ id: payloadId, files: [first] })
      } else if (first.type === 'application/pdf' || name.endsWith('.pdf')) {
        setActiveTab('pdf')
        setPdfIncoming({ id: payloadId, files })
      } else if (first.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name)) {
        setActiveTab('photos')
        setPhotoIncoming({ id: payloadId, files })
      } else {
        notify('Поддерживаются файлы .xlsx, .csv, .pdf, .jpg, .png и .webp')
      }
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [notify])

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="workspace-main">
        <div
          role="tabpanel"
          id="panel-tables"
          aria-labelledby="tab-tables"
          hidden={activeTab !== 'tables'}
        >
          <TableWorkspace onNotify={notify} incomingFiles={tableIncoming} />
        </div>

        <div
          role="tabpanel"
          id="panel-pdf"
          aria-labelledby="tab-pdf"
          hidden={activeTab !== 'pdf'}
        >
          <PdfWorkspace onNotify={notify} incomingFiles={pdfIncoming} />
        </div>

        <div
          role="tabpanel"
          id="panel-photos"
          aria-labelledby="tab-photos"
          hidden={activeTab !== 'photos'}
        >
          <PhotoWorkspace
            onNotify={notify}
            incomingFiles={photoIncoming}
            isActive={activeTab === 'photos'}
          />
        </div>

        <div
          role="tabpanel"
          id="panel-anonymizer"
          aria-labelledby="tab-anonymizer"
          hidden={activeTab !== 'anonymizer'}
        >
          <AnonymizerWorkspace onNotify={notify} />
        </div>

        <div
          role="tabpanel"
          id="panel-diff"
          aria-labelledby="tab-diff"
          hidden={activeTab !== 'diff'}
        >
          <DiffWorkspace onNotify={notify} />
        </div>
      </main>

      <footer className="site-footer">
        <span>
          ЧистоЛист работает в памяти браузера — перетащите любой файл в окно, чтобы открыть
          нужный инструмент (Alt+1..5).
        </span>
        <span className="mono" style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
          Zero-Server Architecture
        </span>
      </footer>

      {isGlobalDragging && (
        <div className="global-drop-overlay" aria-hidden="true">
          <div className="global-drop-box">
            <h2>Отпустите файл</h2>
            <p>ЧистоЛист сам определит формат (.xlsx, .csv, .pdf или фото) и откроет нужный инструмент.</p>
          </div>
        </div>
      )}

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
