import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, register } from '../lib/auth'
import { IconLock, IconMail } from '../icons'

type Mode = 'login' | 'register'

type FooterCopy = { text: string; linkLabel: string; to: string }

const COPY: Record<Mode, { title: string; sub: string; cta: string; footer: FooterCopy }> = {
  login: {
    title: 'Вход в Romb',
    sub: 'Войдите, чтобы управлять подпиской и устройствами',
    cta: 'Продолжить',
    footer: { text: 'Нет аккаунта?', linkLabel: 'Попробовать бесплатно', to: '/register' },
  },
  register: {
    title: 'Создать аккаунт',
    sub: '7 дней полного доступа — без привязки карты',
    cta: 'Создать аккаунт',
    footer: { text: 'Уже есть аккаунт?', linkLabel: 'Войти', to: '/login' },
  },
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copy = COPY[mode]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      if (mode === 'register') await register(email.trim(), password)
      else await login(email.trim(), password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Что-то пошло не так')
      setBusy(false)
    }
  }

  return (
    <form className="rd-authform" onSubmit={handleSubmit}>
      <h1 className="rd-authform__title rd-display">{copy.title}</h1>
      <p className="rd-authform__sub">{copy.sub}</p>

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

      <label className="rd-field">
        <IconLock size={18} />
        <input
          type="password"
          className="rd-field__input"
          placeholder="Пароль (от 8 символов)"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>

      {error && <div className="rd-authform__error">{error}</div>}

      <button type="submit" className="rd-btn rd-btn--primary rd-btn--block rd-btn--lg" disabled={busy}>
        {busy ? 'Подождите…' : copy.cta}
      </button>

      <div className="rd-authform__footer">
        {copy.footer.text}{' '}
        <Link to={copy.footer.to} className="rd-accent rd-authform__link">
          {copy.footer.linkLabel}
        </Link>
      </div>

      <p className="rd-authform__legal">
        Продолжая, вы соглашаетесь с Условиями использования и Политикой конфиденциальности
      </p>
    </form>
  )
}
