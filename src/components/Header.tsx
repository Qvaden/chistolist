import { FileText, GitCompare, Image, Moon, Sun, Table2, UserX } from 'lucide-react'
import { type KeyboardEvent, useRef } from 'react'

export type WorkspaceTab = 'tables' | 'pdf' | 'photos' | 'anonymizer' | 'diff'

interface HeaderProps {
  activeTab: WorkspaceTab
  onSelectTab: (tab: WorkspaceTab) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

const TAB_ORDER: WorkspaceTab[] = ['tables', 'pdf', 'photos', 'anonymizer', 'diff']

export function Header({ activeTab, onSelectTab, theme, onToggleTheme }: HeaderProps) {
  const tabRefs = useRef<Record<WorkspaceTab, HTMLButtonElement | null>>({
    tables: null,
    pdf: null,
    photos: null,
    anonymizer: null,
    diff: null,
  })

  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TAB_ORDER.indexOf(activeTab)
    let nextTab: WorkspaceTab | null = null

    if (e.key === 'ArrowRight') {
      nextTab = TAB_ORDER[(idx + 1) % TAB_ORDER.length]
    } else if (e.key === 'ArrowLeft') {
      nextTab = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]
    } else if (e.key === 'Home') {
      nextTab = TAB_ORDER[0]
    } else if (e.key === 'End') {
      nextTab = TAB_ORDER[TAB_ORDER.length - 1]
    }

    if (nextTab) {
      e.preventDefault()
      onSelectTab(nextTab)
      tabRefs.current[nextTab]?.focus()
    }
  }

  return (
    <header className="site-header">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#090D16" />
          <rect x="1" y="1" width="30" height="30" rx="7" stroke="#314466" strokeWidth="1.5" />
          <path
            d="M10 8.5C10 7.67157 10.6716 7 11.5 7H18.5L22.5 11V23.5C22.5 24.3284 21.8284 25 21 25H11.5C10.6716 25 10 24.3284 10 23.5V8.5Z"
            stroke="#4F7BFF"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M18 7V11.5H22.5" stroke="#4F7BFF" strokeWidth="1.5" strokeLinejoin="round" />
          <path
            d="M13.2 16.8L15.1 18.7L19 14.6"
            stroke="#10D990"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <h1 className="brand-title">ЧистоЛист</h1>
          <p className="brand-subtitle">Приватный офисный комбайн без облака</p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Рабочие инструменты"
        className="workspace-tabs"
        onKeyDown={handleTabKeyDown}
      >
        <button
          ref={(el) => {
            tabRefs.current.tables = el
          }}
          type="button"
          role="tab"
          id="tab-tables"
          aria-selected={activeTab === 'tables'}
          tabIndex={activeTab === 'tables' ? 0 : -1}
          className="workspace-tab"
          onClick={() => onSelectTab('tables')}
        >
          <Table2 size={16} aria-hidden="true" />
          <span>Таблицы</span>
        </button>
        <button
          ref={(el) => {
            tabRefs.current.pdf = el
          }}
          type="button"
          role="tab"
          id="tab-pdf"
          aria-selected={activeTab === 'pdf'}
          tabIndex={activeTab === 'pdf' ? 0 : -1}
          className="workspace-tab"
          onClick={() => onSelectTab('pdf')}
        >
          <FileText size={16} aria-hidden="true" />
          <span>PDF</span>
        </button>
        <button
          ref={(el) => {
            tabRefs.current.photos = el
          }}
          type="button"
          role="tab"
          id="tab-photos"
          aria-selected={activeTab === 'photos'}
          tabIndex={activeTab === 'photos' ? 0 : -1}
          className="workspace-tab"
          onClick={() => onSelectTab('photos')}
        >
          <Image size={16} aria-hidden="true" />
          <span>Фото и сканы</span>
        </button>
        <button
          ref={(el) => {
            tabRefs.current.anonymizer = el
          }}
          type="button"
          role="tab"
          id="tab-anonymizer"
          aria-selected={activeTab === 'anonymizer'}
          tabIndex={activeTab === 'anonymizer' ? 0 : -1}
          className="workspace-tab"
          onClick={() => onSelectTab('anonymizer')}
        >
          <UserX size={16} aria-hidden="true" />
          <span>Анонимайзер</span>
        </button>
        <button
          ref={(el) => {
            tabRefs.current.diff = el
          }}
          type="button"
          role="tab"
          id="tab-diff"
          aria-selected={activeTab === 'diff'}
          tabIndex={activeTab === 'diff' ? 0 : -1}
          className="workspace-tab"
          onClick={() => onSelectTab('diff')}
        >
          <GitCompare size={16} aria-hidden="true" />
          <span>Сравнение</span>
        </button>
      </div>

      <div className="header-actions">
        <div
          className="telemetry-badge"
          title="Вся обработка выполняется локально в памяти браузера"
        >
          <span className="telemetry-dot" aria-hidden="true" />
          <span>Локально</span>
          <span className="telemetry-bytes tabular">0 Б файлов</span>
        </div>

        <button
          type="button"
          className="btn btn-sm"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          style={{ padding: '7px 9px' }}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
      </div>
    </header>
  )
}
