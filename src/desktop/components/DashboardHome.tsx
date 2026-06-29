import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { copyToClipboard } from '../../lib/telegram'
import type {
  ReferralInfoResponse,
  ServerNode,
  Subscription,
  TrafficSeriesResponse,
} from '../../lib/types'
import SubscriptionCard from './SubscriptionCard'
import DevicesPanel from './DevicesPanel'
import { IconPlus } from '../icons'

const GB = 1024 ** 3

function fmtGb(bytes: number): string {
  const val = bytes / GB
  if (val === 0) return '0'
  return val === Math.round(val) ? String(val) : val.toFixed(1)
}

// --- Иконки дизайна (inline, чтобы совпадали с макетом Romb.dc.html) ---
type SvgProps = { d: string; size?: number }
function Glyph({ d, size = 20 }: SvgProps) {
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

const PATH = {
  download: 'M12 3v11m0 0 4-4m-4 4-4-4M5 19h14',
  key: 'M15 7a4 4 0 1 1-3.5 6L7 17.5 5 17l-.5-2L9 10.5A4 4 0 0 1 15 7zM15.5 7.5h.01',
  addDevice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM12 8v8M8 12h8',
  card: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9.5h18M16 13.5h.01',
  gift: 'M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 7h20v5H2zM12 7v14M12 7S10 3 7.5 4 9 7 12 7zM12 7s2-4 4.5-3S15 7 12 7z',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  check: 'M20 6 9 17l-5-5',
  chat: 'M12 5v14M5 12h14',
  question: 'M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.2-1.6 2.4M12 17h.01',
  monitor: 'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 20h8',
}

type Props = {
  subs: Subscription[]
  loading: boolean
  error: string | null
  busy: boolean
  onReload: () => void
  onActivateTrial: () => void
  onRenew: () => void
  onConnect: (sub: Subscription) => void
  onInstall: () => void
  onHowToPay: () => void
  onNewTicket: () => void
  onReferral: () => void
}

export default function DashboardHome({
  subs,
  loading,
  error,
  busy,
  onReload,
  onActivateTrial,
  onRenew,
  onConnect,
  onInstall,
  onHowToPay,
  onNewTicket,
  onReferral,
}: Props) {
  const hasSubs = subs.length > 0
  const primary = subs[0]

  return (
    <>
      {/* --- Мои подписки + график трафика --- */}
      <div className="rd-cab__section-title">Мои подписки</div>
      {loading && <div className="rd-cab__hint">Загрузка…</div>}
      {!loading && error && (
        <div className="rd-cab__hint">
          Ошибка: {error}{' '}
          <button type="button" className="rd-link-btn" onClick={onReload}>
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="rd-dash__top">
          <div className="rd-dash__subs">
            {subs.map((sub) => (
              <SubscriptionCard
                key={sub.uuid}
                sub={sub}
                busy={busy}
                onRenew={onRenew}
                onConnect={() => onConnect(sub)}
              />
            ))}
            {!hasSubs && (
              <button
                type="button"
                className="rd-sub-create"
                onClick={onActivateTrial}
                disabled={busy}
              >
                <span className="rd-sub-create__ic">
                  <IconPlus size={24} />
                </span>
                <span className="rd-sub-create__title">Активировать пробный период</span>
                <span className="rd-sub-create__sub">7 дней полного доступа без оплаты</span>
              </button>
            )}
          </div>

          <TrafficChart primary={primary} />
        </div>
      )}

      {/* --- Быстрые действия --- */}
      <div className="rd-cab__section-title">Быстрые действия</div>
      <QuickActions
        primary={primary}
        onInstall={onInstall}
        onHowToPay={onHowToPay}
      />

      {/* --- Серверы + устройства --- */}
      <div className="rd-dash__row">
        <ServersPanel />
        <DevicesPanel primary={primary} onInstall={onInstall} onReload={onReload} />
      </div>

      {/* --- Реферальная программа --- */}
      <ReferralBanner onReferral={onReferral} />

      {/* --- Поддержка --- */}
      <div className="rd-support-block">
        <div className="rd-cab__section-title">Поддержка</div>
        <div className="rd-support-tiles">
          <button type="button" className="rd-support-tile" onClick={onNewTicket}>
            <span className="rd-support-tile__ic">
              <Glyph d={PATH.chat} size={18} />
            </span>
            <span className="rd-support-tile__text">
              <span className="rd-support-tile__title">Новое обращение</span>
              <span className="rd-support-tile__sub">Связаться с поддержкой</span>
            </span>
          </button>
          <button type="button" className="rd-support-tile" onClick={onInstall}>
            <span className="rd-support-tile__ic">
              <Glyph d={PATH.question} size={18} />
            </span>
            <span className="rd-support-tile__text">
              <span className="rd-support-tile__title">Инструкция по установке</span>
              <span className="rd-support-tile__sub">Пошаговое руководство</span>
            </span>
          </button>
          <button type="button" className="rd-support-tile" onClick={onInstall}>
            <span className="rd-support-tile__ic">
              <Glyph d={PATH.monitor} size={18} />
            </span>
            <span className="rd-support-tile__text">
              <span className="rd-support-tile__title">Установка на устройстве</span>
              <span className="rd-support-tile__sub">Windows · macOS · iOS</span>
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

// --------------------------------------------------------------------------- //
// График «Трафик за период»                                                   //
// --------------------------------------------------------------------------- //
function TrafficChart({ primary }: { primary: Subscription | undefined }) {
  const [data, setData] = useState<TrafficSeriesResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .usage(14)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const points = data?.points ?? []
  const hasData = points.length > 0 && points.some((p) => p.bytes > 0)
  const max = Math.max(1, ...points.map((p) => p.bytes))

  const usedBytes = primary?.used_traffic_bytes ?? 0
  const limitBytes = primary?.traffic_limit_bytes ?? 0
  const headlineTotal = limitBytes > 0 ? `ГБ из ${fmtGb(limitBytes)}` : 'ГБ'

  return (
    <div className="rd-chart">
      <div className="rd-chart__head">
        <div>
          <div className="rd-chart__label">Трафик за период</div>
          <div className="rd-chart__value">
            <span className="rd-chart__num">{fmtGb(usedBytes)}</span>
            <span className="rd-chart__unit">{headlineTotal}</span>
          </div>
        </div>
        {hasData ? (
          <span className="rd-chart__badge">14 дней</span>
        ) : (
          <span className="rd-chart__badge rd-chart__badge--muted">Нет данных</span>
        )}
      </div>

      <div className="rd-chart__bars">
        {hasData
          ? points.map((p) => (
              <div
                key={p.date}
                className="rd-chart__bar"
                style={{ height: `${Math.max(5, (p.bytes / max) * 100)}%` }}
                title={`${p.date}: ${fmtGb(p.bytes)} ГБ`}
              />
            ))
          : Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="rd-chart__bar rd-chart__bar--empty" />
            ))}
      </div>
      <div className="rd-chart__axis">
        <span>{failed || !hasData ? 'нет статистики' : '14 дней назад'}</span>
        <span>сегодня</span>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Быстрые действия                                                            //
// --------------------------------------------------------------------------- //
function QuickActions({
  primary,
  onInstall,
  onHowToPay,
}: {
  primary: Subscription | undefined
  onInstall: () => void
  onHowToPay: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copyKey = () => {
    if (!primary?.subscription_url) return
    copyToClipboard(primary.subscription_url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const freeSlots =
    primary == null
      ? '—'
      : primary.device_limit === 0
        ? 'Безлимит устройств'
        : `${Math.max(0, primary.device_limit - primary.devices_used)} свободно`

  const items = [
    { d: PATH.download, title: 'Скачать приложение', sub: 'Windows · macOS · iOS', onClick: onInstall },
    {
      d: copied ? PATH.check : PATH.key,
      title: copied ? 'Ключ скопирован' : 'Скопировать ключ',
      sub: 'Ссылка подписки',
      onClick: copyKey,
      disabled: !primary?.subscription_url,
    },
    { d: PATH.addDevice, title: 'Добавить устройство', sub: freeSlots, onClick: onInstall },
    { d: PATH.card, title: 'Как оплатить', sub: 'Перевод и активация', onClick: onHowToPay },
  ]

  return (
    <div className="rd-quick">
      {items.map((q) => (
        <button
          key={q.title}
          type="button"
          className="rd-quick__tile"
          onClick={q.onClick}
          disabled={q.disabled}
        >
          <span className="rd-quick__ic">
            <Glyph d={q.d} size={20} />
          </span>
          <span className="rd-quick__text">
            <span className="rd-quick__title">{q.title}</span>
            <span className="rd-quick__sub">{q.sub}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Серверы                                                                     //
// --------------------------------------------------------------------------- //
function loadColor(load: number): string {
  if (load < 45) return '#52c178'
  if (load < 75) return '#d8b53e'
  return '#d9824a'
}

function ServersPanel() {
  const [servers, setServers] = useState<ServerNode[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .servers()
      .then((d) => alive && setServers(d.servers))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="rd-panel">
      <div className="rd-panel__head">
        <h2 className="rd-panel__title">Серверы</h2>
        <span className="rd-panel__hint">онлайн · загрузка</span>
      </div>

      {servers === null && !failed && <div className="rd-panel__empty">Загрузка…</div>}
      {(failed || (servers !== null && servers.length === 0)) && (
        <div className="rd-panel__empty">Список серверов недоступен</div>
      )}

      {servers !== null && servers.length > 0 && (
        <div className="rd-srv">
          {servers.map((s) => (
            <div key={s.name + s.country_code} className="rd-srv__row">
              <span
                className="rd-srv__dot"
                style={{ background: s.online ? '#52c178' : '#566058' }}
              />
              <div className="rd-srv__name">
                <div className="rd-srv__city">{s.name}</div>
                <div className="rd-srv__country">{s.country || s.country_code || '—'}</div>
              </div>
              <div className="rd-srv__load">
                <div
                  className="rd-srv__load-fill"
                  style={{ width: `${s.load}%`, background: loadColor(s.load) }}
                />
              </div>
              <div className="rd-srv__online">{s.users_online}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Реферальная программа                                                       //
// --------------------------------------------------------------------------- //
function ReferralBanner({ onReferral }: { onReferral: () => void }) {
  const [info, setInfo] = useState<ReferralInfoResponse | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .referralInfo()
      .then((d) => alive && setInfo(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const copyLink = () => {
    if (!info?.link) return
    copyToClipboard(info.link)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="rd-ref">
      <span className="rd-ref__ic">
        <Glyph d={PATH.gift} size={26} />
      </span>
      <div className="rd-ref__lead">
        <div className="rd-ref__title">Пригласите друга</div>
        <div className="rd-ref__sub">
          Дарите {info?.bonus_days ?? 10} дней — и получаете столько же себе за каждого друга.
        </div>
      </div>
      <div className="rd-ref__stats">
        <div>
          <div className="rd-ref__stat-label">Приглашено</div>
          <div className="rd-ref__stat-val">{info?.invited ?? 0}</div>
        </div>
        <div>
          <div className="rd-ref__stat-label">Оплатили</div>
          <div className="rd-ref__stat-val">{info?.rewarded ?? 0}</div>
        </div>
      </div>
      <div className="rd-ref__actions">
        <button type="button" className="rd-btn rd-btn--primary" onClick={copyLink} disabled={!info?.link}>
          <Glyph d={copied ? PATH.check : PATH.copy} size={15} />
          {copied ? 'Скопировано' : 'Скопировать ссылку'}
        </button>
        <button type="button" className="rd-btn rd-btn--ghost" onClick={onReferral}>
          Подробнее
        </button>
      </div>
    </div>
  )
}
