import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { resetPassword } from '../lib/auth'
import { IconLock } from '../icons'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setError((err as Error).message || 'Ссылка недействительна или устарела')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <form className="rd-authform" onSubmit={handleSubmit}>
        <h1 className="rd-authform__title rd-display">Новый пароль</h1>
        {!token ? (
          <p className="rd-authform__sub">
            Ссылка неполная. Запросите сброс пароля заново на странице входа.
          </p>
        ) : done ? (
          <p className="rd-authform__sub">Пароль изменён. Перенаправляем ко входу…</p>
        ) : (
          <>
            <p className="rd-authform__sub">Задайте новый пароль для вашего аккаунта</p>

            <label className="rd-field">
              <IconLock size={18} />
              <input
                type="password"
                className="rd-field__input"
                placeholder="Новый пароль (от 8 символов)"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <label className="rd-field">
              <IconLock size={18} />
              <input
                type="password"
                className="rd-field__input"
                placeholder="Повторите пароль"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            </label>

            {error && <div className="rd-authform__error">{error}</div>}

            <button
              type="submit"
              className="rd-btn rd-btn--primary rd-btn--block rd-btn--lg"
              disabled={busy}
            >
              {busy ? 'Подождите…' : 'Сохранить пароль'}
            </button>
          </>
        )}

        <div className="rd-authform__footer">
          <Link to="/login" className="rd-accent rd-authform__link">
            ← Вернуться ко входу
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
