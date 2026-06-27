import { useState } from 'react'
import { api } from '../lib/api'
import { haptic } from '../lib/telegram'
import { IconCard, IconClose } from '../icons'

// Активация промокода: вводим код → бэкенд продлевает подписку на бонусные дни.
export default function PromoModal({ onClose, onApplied }: { onClose: () => void; onApplied?: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bonusDays, setBonusDays] = useState<number | null>(null)

  const submit = async () => {
    const value = code.trim()
    if (!value || busy) return
    setError(null)
    setBusy(true)
    try {
      const res = await api.redeemPromo(value)
      setBonusDays(res.bonus_days)
      haptic('success')
      onApplied?.()
    } catch (err) {
      setError((err as Error).message || 'Код недействителен')
      haptic('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--config" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="close">
          <IconClose size={22} />
        </button>
        <span className="modal__icon">
          <IconCard size={32} />
        </span>
        <div className="modal__title" style={{ fontSize: 22 }}>
          Промокод
        </div>

        {bonusDays !== null ? (
          <>
            <div className="modal__sub">
              Готово! Подписка продлена на <b>{bonusDays} дн.</b>
            </div>
            <button className="btn btn-primary" onClick={onClose}>
              Отлично
            </button>
          </>
        ) : (
          <>
            <div className="modal__sub">Введите промокод — добавим дни к подписке</div>
            <input
              className="rd-field__input promo-input"
              placeholder="НАПРИМЕР: WELCOME"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
            {error && <div className="rd-authform__error">{error}</div>}
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Проверяем…' : 'Применить'}
            </button>
          </>
        )}

        <button className="btn-text" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
