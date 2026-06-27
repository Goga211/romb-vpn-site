import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { requestPasswordReset } from '../lib/auth'
import { IconMail } from '../icons'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError((err as Error).message || 'Что-то пошло не так')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <form className="rd-authform" onSubmit={handleSubmit}>
        <h1 className="rd-authform__title rd-display">Сброс пароля</h1>
        {sent ? (
          <p className="rd-authform__sub">
            Если адрес <b>{email.trim()}</b> зарегистрирован, мы отправили на него письмо со
            ссылкой для сброса пароля. Проверьте почту, в том числе папку «Спам».
          </p>
        ) : (
          <>
            <p className="rd-authform__sub">Введите e-mail — пришлём ссылку для нового пароля</p>

            <label className="rd-field">
              <IconMail size={18} />
              <input
                type="email"
                className="rd-field__input"
                placeholder="you@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            {error && <div className="rd-authform__error">{error}</div>}

            <button
              type="submit"
              className="rd-btn rd-btn--primary rd-btn--block rd-btn--lg"
              disabled={busy}
            >
              {busy ? 'Подождите…' : 'Отправить ссылку'}
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
