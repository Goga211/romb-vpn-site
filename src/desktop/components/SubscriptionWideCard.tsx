import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Subscription } from '../../lib/types'

const GB = 1024 ** 3

function fmtGb(bytes: number): string {
  const val = bytes / GB
  if (val === 0) return '0'
  return val === Math.round(val) ? String(val) : val.toFixed(1)
}

// Иконки (inline, единый стиль с DashboardHome)
const PATH = {
  shield: 'M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z',
}

function Glyph({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

type Props = {
  sub: Subscription
  busy: boolean
  onRenew: () => void
  onConnect: () => void
}

export default function SubscriptionWideCard({ sub, busy, onRenew, onConnect }: Props) {
  const [locations, setLocations] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    api
      .servers()
      .then((d) => {
        if (!alive) return
        const countries = new Set(
          d.servers.map((s) => s.country_code || s.country || s.name).filter(Boolean),
        )
        setLocations(countries.size)
      })
      .catch(() => alive && setLocations(null))
    return () => {
      alive = false
    }
  }, [])

  const unlimited = sub.traffic_limit_bytes === 0
  const percent = unlimited
    ? 100
    : Math.min(100, Math.round((sub.used_traffic_bytes / sub.traffic_limit_bytes) * 100))
  const devices =
    sub.device_limit === 0 ? `${sub.devices_used} / ∞` : `${sub.devices_used} / ${sub.device_limit}`

  return (
    <div className="rd-asub">
      <div className="rd-asub__head">
        <div className="rd-asub__id">
          <span className="rd-asub__shield">
            <Glyph d={PATH.shield} size={24} />
          </span>
          <div>
            <div className="rd-asub__name">
              {sub.label}
              {sub.pro && <span className="rd-asub__badge">PRO</span>}
            </div>
            <div className="rd-asub__meta">Действует до {sub.expire_text}</div>
          </div>
        </div>
        <span className={`rd-asub__status ${sub.expired ? 'is-expired' : ''}`}>
          <span className="rd-asub__dot" />
          {sub.expired ? 'Истекла' : 'Активна'}
        </span>
      </div>

      <div className="rd-asub__traffic">
        <div className="rd-asub__traffic-row">
          <span className="rd-asub__traffic-label">Израсходовано</span>
          <span className="rd-asub__traffic-val">
            {fmtGb(sub.used_traffic_bytes)} ГБ
            {unlimited ? (
              <span className="rd-sub__traffic-unl" title="Безлимитный трафик">
                ∞ Безлимит
              </span>
            ) : (
              <span className="rd-sub__traffic-total"> / {fmtGb(sub.traffic_limit_bytes)} ГБ</span>
            )}
          </span>
        </div>
        <div className="rd-asub__bar">
          <div
            className={`rd-sub__bar-fill${unlimited ? ' rd-sub__bar-fill--unl' : ''}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="rd-asub__stats">
        <div className="rd-asub__stat">
          <div className="rd-asub__stat-label">Устройства</div>
          <div className="rd-asub__stat-val">{devices}</div>
        </div>
        <div className="rd-asub__stat">
          <div className="rd-asub__stat-label">Локаций</div>
          <div className="rd-asub__stat-val">
            {locations ?? '—'} <span className="rd-asub__stat-unit">стран</span>
          </div>
        </div>
        <div className="rd-asub__stat">
          <div className="rd-asub__stat-label">Скорость</div>
          <div className="rd-asub__stat-val">
            до 1 <span className="rd-asub__stat-unit">Гбит/с</span>
          </div>
        </div>
      </div>

      <div className="rd-asub__actions">
        <button
          type="button"
          className="rd-btn rd-btn--primary"
          disabled={busy}
          onClick={onRenew}
        >
          Продлить подписку
        </button>
        <button type="button" className="rd-btn rd-btn--ghost" onClick={onConnect}>
          Подключить устройство
        </button>
      </div>
    </div>
  )
}
