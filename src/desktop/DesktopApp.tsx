import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme'
import { useSession } from './hooks/useSession'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import Login from './pages/Login'
import Register from './pages/Register'
import Cabinet from './pages/Cabinet'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import './desktop.css'

// Шрифты Unbounded + Golos Text грузим ТОЛЬКО на десктопе и только в рантайме:
// мобильный мини-апп сознательно не тянет внешние шрифты (render-blocking запросы
// виснут в Telegram WebView с DPI), а этот код в Telegram не выполняется вовсе.
function useDesktopFonts(): void {
  useEffect(() => {
    const id = 'romb-desktop-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700&family=Golos+Text:wght@400;500;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useSession()
  if (loading) return <div className="rd rd-page" />
  if (!session.authenticated) return <Navigate to="/login" replace />
  return children
}

export default function DesktopApp() {
  useDesktopFonts()
  return (
    <ThemeProvider>
      <div className="rd">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/app/*"
              element={
                <RequireAuth>
                  <Cabinet />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  )
}
