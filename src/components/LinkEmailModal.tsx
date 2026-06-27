import { useState } from 'react'
import { api } from '../lib/api'
import { haptic } from '../lib/telegram'
import { IconClose, IconLock } from '../icons'

type Status = 'idle' | 'saving' | 'done' | 'error'

const PASSWORD_MIN = 8

// Привязка e-mail+пароля к текущему Telegram-аккаунту — чтобы входить на сайт
// (десктоп) и видеть ту же подписку. Вызывается из профиля мини-аппа.
export default function LinkEmailModal({
  onClose,
  onLinked,
}: {
  onClose: () => void
  onLinked: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const canSubmit = email.trim() !== '' && password.length >= PASSWORD_MIN && status !== 'saving'

  const save = async () => {
    if (!canSubmit) return
    setStatus('saving')
    setError(null)
    try {
      await api.linkEmail(email.trim(), password)
      haptic('success')
      setStatus('done')
      onLinked()
    } catch (e) {
      haptic('error')
      setError((e as Error).message)
      setStatus('error')
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--config" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="close">
          <IconClose size={22} />
        </button>
        <span className="modal__icon">
          <IconLock size={32} />
        </span>
        <div className="modal__title" style={{ fontSize: 22 }}>
          Вход на сайте
        </div>

        {status === 'done' ? (
          <>
            <div className="modal__sub">
              Почта привязана. Теперь входите на сайте по этому e-mail и паролю — подписка
              будет та же.
            </div>
            <button className="btn btn-primary" onClick={onClose}>
              Готово
            </button>
          </>
        ) : (
          <>
            <div className="modal__sub">
              Задайте e-mail и пароль, чтобы заходить в кабинет на компьютере. Подписка
              останется общей с Telegram.
            </div>

            <input
              className="modal-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status === 'error') setStatus('idle')
              }}
            />
            <input
              className="modal-input"
              type="password"
              autoComplete="new-password"
              placeholder={`Пароль (от ${PASSWORD_MIN} символов)`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (status === 'error') setStatus('idle')
              }}
              minLength={PASSWORD_MIN}
            />

            {error && <div className="cfg-error">{error}</div>}
            <button className="btn btn-primary" onClick={save} disabled={!canSubmit}>
              {status === 'saving' ? 'Сохраняем…' : 'Привязать'}
            </button>
            <button className="btn-text" onClick={onClose}>
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  )
}
