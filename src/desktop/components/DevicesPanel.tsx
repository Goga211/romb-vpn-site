import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Device, Subscription } from '../../lib/types'

// --- Иконки (inline, единый стиль с DashboardHome) ---
const PATH = {
  laptop: 'M4 6h16v9H4zM2 18h20M9 18l.5 1.5h5L15 18',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  close: 'M6 6l12 12M18 6 6 18',
  empty: 'M4 6h16v9H4zM2 18h20M9 18l.5 1.5h5L15 18',
}

function Glyph({ d, size = 18 }: { d: string; size?: number }) {
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

function fmtAgo(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'недавно'
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

type Props = {
  primary: Subscription | undefined
  onInstall: () => void
  onReload: () => void
}

export default function DevicesPanel({ primary, onInstall, onReload }: Props) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (!primary?.uuid) {
      setDevices([])
      return
    }
    let alive = true
    api
      .devices(primary.uuid)
      .then((d) => alive && setDevices(d.devices))
      .catch(() => alive && setDevices([]))
    return () => {
      alive = false
    }
  }, [primary?.uuid])

  const handleRemove = async (hwid: string) => {
    if (!primary?.uuid || removing) return
    if (!window.confirm('Удалить это устройство? Оно потеряет доступ к VPN.')) return
    setRemoving(hwid)
    try {
      const res = await api.deleteDevice(primary.uuid, hwid)
      setDevices(res.devices)
      onReload()
    } catch {
      window.alert('Не удалось удалить устройство. Попробуйте ещё раз.')
    } finally {
      setRemoving(null)
    }
  }

  const used = primary?.devices_used ?? 0
  const limit = primary?.device_limit ?? 0
  const counter = limit === 0 ? `${used} / ∞` : `${used} / ${limit}`
  const list = devices ?? []

  return (
    <div className="rd-panel">
      <div className="rd-panel__head">
        <h2 className="rd-panel__title">Устройства</h2>
        <span className="rd-panel__count">{counter}</span>
      </div>

      {list.length > 0 ? (
        <div className="rd-dev">
          {list.map((d) => {
            const isPhone = /ios|android|phone/i.test(d.platform || d.device_model || '')
            return (
              <div key={d.hwid} className="rd-dev__row">
                <span className="rd-dev__ic">
                  <Glyph d={isPhone ? PATH.phone : PATH.laptop} size={18} />
                </span>
                <div className="rd-dev__name">
                  <div className="rd-dev__model">{d.device_model || d.platform || 'Устройство'}</div>
                  <div className="rd-dev__meta">
                    {[d.platform, fmtAgo(d.created_at)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="rd-dev__del"
                  title="Удалить устройство"
                  aria-label="Удалить устройство"
                  onClick={() => handleRemove(d.hwid)}
                  disabled={removing === d.hwid}
                >
                  <Glyph d={PATH.close} size={16} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rd-dev__empty">
          <span className="rd-dev__empty-ic">
            <Glyph d={PATH.empty} size={22} />
          </span>
          <div className="rd-dev__empty-title">Нет подключённых устройств</div>
          <div className="rd-dev__empty-sub">Подключите устройство к подписке</div>
          <button type="button" className="rd-btn rd-btn--primary" onClick={onInstall}>
            Подключить устройство
          </button>
        </div>
      )}
    </div>
  )
}
