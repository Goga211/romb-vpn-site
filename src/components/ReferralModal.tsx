import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { copyToClipboard, haptic } from '../lib/telegram'
import type { ReferralInfoResponse } from '../lib/types'
import { IconCheck, IconClose, IconDoc, IconSend } from '../icons'

// Реферальная программа: личная ссылка-приглашение + статистика. Бонус
// пригласившему начисляется при первой оплате приглашённого (на бэкенде).
export default function ReferralModal({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<ReferralInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .referralInfo()
      .then((res) => alive && setInfo(res))
      .catch(() => alive && setInfo(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const copy = () => {
    if (!info) return
    const ok = copyToClipboard(info.link)
    haptic(ok ? 'success' : 'error')
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--config" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="close">
          <IconClose size={22} />
        </button>
        <span className="modal__icon">
          <IconSend size={30} />
        </span>
        <div className="modal__title" style={{ fontSize: 22 }}>
          Реферальная программа
        </div>

        {loading ? (
          <div className="pay-empty">Загрузка…</div>
        ) : !info ? (
          <div className="pay-empty">Не удалось загрузить</div>
        ) : (
          <>
            <div className="modal__sub">
              Приглашайте друзей по ссылке. Когда приглашённый оплатит подписку — вам
              начислим <b>+{info.bonus_days} дн.</b>
            </div>

            {/* Саму ссылку не показываем — только кнопка копирования. */}
            <button
              type="button"
              className="btn btn-primary btn-lg ref-copy-btn"
              onClick={copy}
              aria-label="Скопировать реферальную ссылку"
              style={{ width: '100%', margin: '6px 0' }}
            >
              {copied ? <IconCheck size={18} /> : <IconDoc size={18} />}
              {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            </button>

            <div className="pay-info">
              <div className="pay-info__row">
                <span className="pay-info__label">Приглашено</span>
                <span className="pay-info__value">{info.invited}</span>
              </div>
              <div className="pay-info__row">
                <span className="pay-info__label">Оплатили (начислен бонус)</span>
                <span className="pay-info__value">{info.rewarded}</span>
              </div>
            </div>
          </>
        )}

        <button className="btn-text" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
