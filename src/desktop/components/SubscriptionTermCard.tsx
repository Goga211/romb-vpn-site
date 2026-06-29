import type { Subscription } from '../../lib/types'
import { RENEW_PRICE_RUB, RENEW_PRICE_USD } from '../../data'

const MS_DAY = 86_400_000
// Период ручного продления (6 месяцев) — база для заполнения кольца.
const RENEW_DAYS = 182
// Длина окружности r=43: 2·π·43 ≈ 270.18
const CIRC = 270.18

function daysLeftOf(sub: Subscription): number | null {
  const ms = new Date(sub.expire_at).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.ceil((ms - Date.now()) / MS_DAY))
}

type Props = {
  sub: Subscription
}

export default function SubscriptionTermCard({ sub }: Props) {
  const days = daysLeftOf(sub)
  const fraction = days == null ? 0 : Math.max(0, Math.min(1, days / RENEW_DAYS))
  const dashoffset = CIRC * (1 - fraction)

  const counter = sub.expired ? 'истекла' : 'дней осталось'
  const bigNumber = sub.expired ? '0' : (days?.toString() ?? '—')

  return (
    <div className="rd-term">
      <div className="rd-term__title">Срок действия</div>

      <div className="rd-term__ring">
        <svg viewBox="0 0 100 100" className="rd-term__svg">
          <circle className="rd-term__track" cx="50" cy="50" r="43" />
          <circle
            className="rd-term__fill"
            cx="50"
            cy="50"
            r="43"
            strokeDasharray={CIRC}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <div className="rd-term__center">
          <div className="rd-term__num">{bigNumber}</div>
          <div className="rd-term__num-label">{counter}</div>
        </div>
      </div>

      <div className="rd-term__rows">
        <div className="rd-term__row">
          <span className="rd-term__row-label">Действует до</span>
          <span className="rd-term__row-val">{sub.expire_text}</span>
        </div>
        <div className="rd-term__row">
          <span className="rd-term__row-label">Стоимость продления</span>
          <span className="rd-term__row-val">
            {RENEW_PRICE_USD} · {RENEW_PRICE_RUB}
          </span>
        </div>
        <div className="rd-term__row">
          <span className="rd-term__row-label">Оплата</span>
          <span className="rd-term__row-val">Переводом, вручную</span>
        </div>
      </div>
    </div>
  )
}
