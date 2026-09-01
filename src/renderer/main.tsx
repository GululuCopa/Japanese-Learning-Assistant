import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ApiProvider, browserApi } from './state/api'
import './styles/app.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element missing')
}

createRoot(root).render(
  <React.StrictMode>
    <ApiProvider api={browserApi()}>
      <App />
    </ApiProvider>
  </React.StrictMode>,
)
