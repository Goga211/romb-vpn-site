import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { copyToClipboard } from '../../lib/telegram'
import type { ReferralInfoResponse, Subscription } from '../../lib/types'
import { CHANNEL_URL, FAQ_URL } from '../../data'

type Tab = 'referral' | 'connect' | 'useful'

const TAB_TITLES: Record<Tab, string> = {
  referral: 'Реферальная программа',
  connect: 'Подключение',
  useful: 'Полезное',
}

type Props = {
  primary: Subscription | undefined
  onConnect: () => void
  onInstall: () => void
  onNews: () => void
}

export default function SubscriptionPanel({ primary, onConnect, onInstall, onNews }: Props) {
  const [tab, setTab] = useState<Tab>('referral')

  return (
    <div className="rd-spanel">
      <div className="rd-spanel__head">
        <h2 className="rd-spanel__title">{TAB_TITLES[tab]}</h2>
        <div className="rd-sup__tabs rd-spanel__tabs">
          <button
            type="button"
            className={tab === 'referral' ? 'is-active' : ''}
            onClick={() => setTab('referral')}
          >
            Реферальная
          </button>
          <button
            type="button"
            className={tab === 'connect' ? 'is-active' : ''}
            onClick={() => setTab('connect')}
          >
            Подключение
          </button>
          <button
            type="button"
            className={tab === 'useful' ? 'is-active' : ''}
            onClick={() => setTab('useful')}
          >
            Полезное
          </button>
        </div>
      </div>

      {tab === 'referral' && <ReferralTab />}
      {tab === 'connect' && (
        <ConnectTab primary={primary} onConnect={onConnect} onInstall={onInstall} />
      )}
      {tab === 'useful' && <UsefulTab onNews={onNews} />}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Таб «Реферальная»                                                           //
// --------------------------------------------------------------------------- //
function ReferralTab() {
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
    if (copyToClipboard(info.link)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  if (loading) return <div className="rd-panel__empty">Загрузка…</div>
  if (!info) return <div className="rd-panel__empty">Не удалось загрузить реферальные данные</div>

  // «Начислено дней» — реально начисленный бонус (оплатившие × бонус за друга).
  // «Ожидают активации» — приглашённые, ещё не оплатившие.
  // Веха считается по ОПЛАТИВШИМ друзьям (rewarded) — как и начисляет бэкенд.
  const creditedDays = info.rewarded * info.bonus_days
  const pending = Math.max(0, info.invited - info.rewarded)
  const goalReached = Math.min(info.rewarded, info.goal)
  const goalLeft = Math.max(0, info.goal - info.rewarded)
  const goalPercent = info.goal > 0 ? Math.round((goalReached / info.goal) * 100) : 0

  return (
    <>
      <div className="rd-ref__hero">
        <div className="rd-ref__hero-body">
          <h3 className="rd-ref__hero-title">
            Приглашайте друзей —<br />
            получайте бесплатные дни
          </h3>
          <p className="rd-ref__hero-desc">
            За каждого друга, оформившего подписку, вы оба получаете{' '}
            <b>+{info.bonus_days} дней</b>.
          </p>
          <div className="rd-ref__link-row">
            <input className="rd-ref__link" value={info.link} readOnly aria-label="Реферальная ссылка" />
            <button type="button" className="rd-btn rd-btn--primary rd-ref__copy" onClick={copy}>
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        </div>
        <div className="rd-ref__badge">
          <span className="rd-ref__badge-num">+{info.bonus_days}</span>
          <span className="rd-ref__badge-label">дней</span>
        </div>
      </div>

      <div className="rd-ref__stats">
        <div className="rd-ref__stat">
          <div className="rd-ref__stat-label">Приглашено</div>
          <div className="rd-ref__stat-val">{info.invited}</div>
        </div>
        <div className="rd-ref__stat">
          <div className="rd-ref__stat-label">Начислено дней</div>
          <div className="rd-ref__stat-val rd-ref__stat-val--accent">{creditedDays}</div>
        </div>
        <div className="rd-ref__stat">
          <div className="rd-ref__stat-label">Ожидают активации</div>
          <div className="rd-ref__stat-val">{pending}</div>
        </div>
      </div>

      <div className="rd-ref__goal">
        <div className="rd-ref__goal-head">
          <span className="rd-ref__goal-title">До награды «{info.goal} друзей»</span>
          <span className="rd-ref__goal-meta">
            осталось {goalLeft} · бонус +{info.goal_bonus_days} дней
          </span>
        </div>
        <div className="rd-ref__goal-bar">
          <div className="rd-ref__goal-fill" style={{ width: `${goalPercent}%` }} />
        </div>
      </div>
    </>
  )
}

// --------------------------------------------------------------------------- //
// Таб «Подключение»                                                           //
// --------------------------------------------------------------------------- //
function ConnectTab({
  primary,
  onConnect,
  onInstall,
}: {
  primary: Subscription | undefined
  onConnect: () => void
  onInstall: () => void
}) {
  const [copied, setCopied] = useState(false)
  const url = primary?.subscription_url ?? ''

  const copy = () => {
    if (!url) return
    if (copyToClipboard(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  if (!primary) {
    return <div className="rd-panel__empty">Нет активной подписки для подключения</div>
  }

  return (
    <>
      <div className="rd-ref__hero rd-ref__hero--plain">
        <div className="rd-ref__hero-body">
          <h3 className="rd-ref__hero-title">Ссылка подписки</h3>
          <p className="rd-ref__hero-desc">
            Вставьте эту ссылку в приложение, чтобы подключить серверы и локации.
          </p>
          <div className="rd-ref__link-row">
            <input className="rd-ref__link" value={url} readOnly aria-label="Ссылка подписки" />
            <button type="button" className="rd-btn rd-btn--primary rd-ref__copy" onClick={copy}>
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        </div>
      </div>

      <div className="rd-spanel__actions">
        <button type="button" className="rd-btn rd-btn--primary" onClick={onConnect}>
          Подключить устройство
        </button>
        <button type="button" className="rd-btn rd-btn--ghost" onClick={onInstall}>
          Скачать приложение
        </button>
      </div>
    </>
  )
}

// --------------------------------------------------------------------------- //
// Таб «Полезное»                                                              //
// --------------------------------------------------------------------------- //
function UsefulTab({ onNews }: { onNews: () => void }) {
  const navigate = useNavigate()

  const links: { label: string; hint: string; onClick: () => void }[] = [
    {
      label: 'Частые вопросы',
      hint: 'Инструкции и ответы',
      onClick: () => window.open(FAQ_URL, '_blank', 'noopener,noreferrer'),
    },
    { label: 'Новости', hint: 'Обновления сервиса', onClick: onNews },
    ...(CHANNEL_URL
      ? [
          {
            label: 'Telegram-канал',
            hint: 'Анонсы и поддержка',
            onClick: () => window.open(CHANNEL_URL, '_blank', 'noopener,noreferrer'),
          },
        ]
      : []),
    { label: 'Политика конфиденциальности', hint: 'Как храним данные', onClick: () => navigate('/privacy') },
    { label: 'Пользовательское соглашение', hint: 'Условия использования', onClick: () => navigate('/terms') },
  ]

  return (
    <div className="rd-spanel__links">
      {links.map((l) => (
        <button key={l.label} type="button" className="rd-spanel__link" onClick={l.onClick}>
          <div className="rd-spanel__link-text">
            <span className="rd-spanel__link-label">{l.label}</span>
            <span className="rd-spanel__link-hint">{l.hint}</span>
          </div>
          <span className="rd-spanel__link-arrow" aria-hidden>
            →
          </span>
        </button>
      ))}
    </div>
  )
}
