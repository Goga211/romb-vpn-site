import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Payment } from '../lib/types'
import { IconCard, IconClose } from '../icons'

export default function PaymentsModal({ onClose }: { onClose: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api
      .payments()
      .then((res) => alive && setPayments(res.payments))
      .catch(() => alive && setPayments([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

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
          Платежи
        </div>
        <div className="modal__sub">История ваших платежей</div>

        {loading ? (
          <div className="pay-empty">Загрузка…</div>
        ) : payments.length === 0 ? (
          <div className="pay-empty">Платежей пока нет</div>
        ) : (
          <div className="pay-list">
            {payments.map((p) => (
              <div key={p.id} className="pay-row">
                <span className="pay-row__txt">
                  <div className="pay-row__title">{p.title}</div>
                  <div className="pay-row__date">{p.date}</div>
                </span>
                <span className={`pay-row__amount pay-row__amount--${p.status}`}>{p.amount}</span>
              </div>
            ))}
          </div>
        )}

        <button className="btn-text" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
