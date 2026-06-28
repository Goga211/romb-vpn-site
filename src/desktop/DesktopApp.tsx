import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme'
import { useSession } from './hooks/useSession'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
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
  const { session, loading, confirmed, reload } = useSession()

  // Если входа нет, но это ещё НЕ подтверждено сервером (только транзиентная
  // ошибка) — не выкидываем на /login, а тихо повторяем запрос. Так блип сети
  // при заходе не сбрасывает пользователя из кабинета.
  useEffect(() => {
    if (!loading && !confirmed && !session.authenticated) {
      const t = setTimeout(() => void reload(), 1500)
      return () => clearTimeout(t)
    }
  }, [loading, confirmed, session.authenticated, reload])

  if (loading) return <div className="rd rd-page" />
  // Редиректим только когда разлогин ПОДТВЕРЖДЁН ответом сервера. Иначе ждём.
  if (!session.authenticated) {
    if (!confirmed) return <div className="rd rd-page" />
    return <Navigate to="/login" replace />
  }
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
