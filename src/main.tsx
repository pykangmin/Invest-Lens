import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/index.css'
import App from './layout/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
