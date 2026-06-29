import type { Subscription } from '../../lib/types'

type Props = {
  sub: Subscription
  busy?: boolean
  onRenew: () => void
  onConnect: () => void
}

const GB = 1024 ** 3

function fmtGb(bytes: number): string {
  const val = bytes / GB
  return val === Math.round(val) ? String(val) : val.toFixed(1)
}

export default function SubscriptionCard({ sub, busy, onRenew, onConnect }: Props) {
  const unlimited = sub.traffic_limit_bytes === 0
  const percent = unlimited
    ? 100
    : Math.min(100, Math.round((sub.used_traffic_bytes / sub.traffic_limit_bytes) * 100))
  const trafficLabel = `${fmtGb(sub.used_traffic_bytes)} ГБ`
  const trafficTotal = unlimited ? null : `${fmtGb(sub.traffic_limit_bytes)} ГБ`
  const devicesLabel =
    sub.device_limit === 0 ? `${sub.devices_used} / ∞` : `${sub.devices_used} / ${sub.device_limit}`

  return (
    <div className="rd-sub">
      <div className="rd-sub__head">
        <div className="rd-sub__name">
          <span className="rd-sub__label">{sub.label}</span>
          {sub.pro && <span className="rd-sub__badge">PRO</span>}
        </div>
        <span className={`rd-sub__status ${sub.expired ? 'is-expired' : ''}`}>
          <span className="rd-sub__dot" />
          {sub.expired ? 'Истекла' : 'Активна'}
        </span>
      </div>

      <div className="rd-sub__traffic-row">
        <span>Трафик</span>
        <span className="rd-sub__traffic-val">
          {trafficLabel}
          {unlimited ? (
            <span className="rd-sub__traffic-unl" title="Безлимитный трафик">
              ∞ Безлимит
            </span>
          ) : (
            <span className="rd-sub__traffic-total"> / {trafficTotal}</span>
          )}
        </span>
      </div>
      <div className="rd-sub__bar">
        <div
          className={`rd-sub__bar-fill${unlimited ? ' rd-sub__bar-fill--unl' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="rd-sub__stats">
        <div>
          <div className="rd-sub__stat-label">Устройства</div>
          <div className="rd-sub__stat-val">{devicesLabel}</div>
        </div>
        <div>
          <div className="rd-sub__stat-label">Действует до</div>
          <div className="rd-sub__stat-val">{sub.expire_text}</div>
        </div>
      </div>

      <div className="rd-sub__actions">
        <button type="button" className="rd-btn rd-btn--primary" disabled={busy} onClick={onRenew}>
          Продлить
        </button>
        <button type="button" className="rd-btn rd-btn--ghost" onClick={onConnect}>
          Подключить
        </button>
      </div>
    </div>
  )
}
