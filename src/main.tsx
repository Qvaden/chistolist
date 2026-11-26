import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/global.css'

if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
  // @ts-expect-error Conditional CDN polyfill for browsers without native Popover API
  void import(/* @vite-ignore */ 'https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
