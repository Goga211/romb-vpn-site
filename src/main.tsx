import React from 'react'
import ReactDOM from 'react-dom/client'
import RootApp from './RootApp'
import { getInitData } from './lib/telegram'
import { initTheme } from './lib/theme'
import './index.css'

// Тема до первого рендера — чтобы не было вспышки светлой темы на тёмных устройствах.
//  • есть сохранённый выбор пользователя (десктопный тумблер) — он главнее всего;
//  • иначе вне Telegram (десктоп) по умолчанию тёмная — ведущий вариант дизайна;
//  • иначе (мобильный мини-апп) — следуем за темой устройства/Telegram.
function initialTheme(): void {
  let stored: string | null = null
  try {
    stored = localStorage.getItem('romb_theme')
  } catch {
    /* localStorage недоступен — не критично */
  }
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.dataset.theme = stored
  } else if (getInitData() === '') {
    document.documentElement.dataset.theme = 'dark'
  } else {
    initTheme()
  }
}

initialTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)
