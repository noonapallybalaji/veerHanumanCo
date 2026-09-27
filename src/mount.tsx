import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

/**
 * Mounts the app. Kept separate from main.tsx so that importing App — and
 * with it every module that reads content at module scope — happens only
 * after the content store has hydrated.
 */
export function mount() {
  const container = document.getElementById('root')
  if (!container) throw new Error('Root element #root was not found in index.html')

  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
