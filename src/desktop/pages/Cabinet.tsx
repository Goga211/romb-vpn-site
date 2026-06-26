import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { type Section } from '../components/Sidebar'
import SubscriptionCard from '../components/SubscriptionCard'
import ThemeToggle from '../components/ThemeToggle'
import { useSession } from '../hooks/useSession'
import { logout } from '../lib/auth'
import { IconMail, IconMonitor, IconPlus } from '../icons'
import { useSubscriptions } from '../../hooks/useSubscriptions'
import type { Subscription } from '../../lib/types'
import ConfigModal from '../../components/ConfigModal'
import InstallModal from '../../components/InstallModal'
import PaymentsModal from '../../components/PaymentsModal'
import HowToPayModal from '../../components/HowToPayModal'
import SupportScreen from '../../screens/SupportScreen'

const TITLES: Record<Section, string> = {
  home: 'Главная',
  subscriptions: 'Подписки',
  support: 'Поддержка',
  payments: 'Платежи',
}

export default function Cabinet() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { subs, loading, error, reload, activateTrial, renew } = useSubscriptions()

  const [active, setActive] = useState<Section>('home')
  const [busy, setBusy] = useState(false)
  const [configSub, setConfigSub] = useState<Subscription | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [showHowToPay, setShowHowToPay] = useState(false)

  const displayName = session.display_name || 'Аккаунт'
  const subtitle = session.email || 'Личный кабинет'

  const handleNavigate = (section: Section) => {
    if (section === 'payments') {
      setShowPayments(true)
      return
    }
    setActive(section)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleAdd = async () => {
    if (busy) return
    setBusy(true)
    try {
      await activateTrial()
    } catch {
      /* ошибку покажет состояние error при следующем reload */
    } finally {
      setBusy(false)
    }
  }

  const handleRenew = async (sub: Subscription) => {
    if (busy) return
    setBusy(true)
    try {
      await renew(sub.uuid)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rd-cab">
      <Sidebar
        active={active}
        onNavigate={handleNavigate}
        displayName={displayName}
        subtitle={subtitle}
        onLogout={handleLogout}
      />

      <main className="rd-cab__main">
        <div className="rd-cab__topbar">
          <div>
            <h1 className="rd-cab__title rd-display">{TITLES[active]}</h1>
            <p className="rd-cab__subtitle">Управление подписками и аккаунтом</p>
          </div>
          <div className="rd-cab__actions">
            <ThemeToggle />
            <button type="button" className="rd-btn rd-btn--ghost" onClick={() => setShowHowToPay(true)}>
              Как оплатить
            </button>
            <button type="button" className="rd-btn rd-btn--primary" onClick={handleAdd} disabled={busy}>
              <IconPlus size={18} /> Новая подписка
            </button>
          </div>
        </div>

        {active === 'support' ? (
          <div className="rd-cab__support">
            <SupportScreen isAdmin={false} />
          </div>
        ) : (
          <>
            {!session.email && (
              <div className="rd-notice">
                <IconMail size={20} />
                <div className="rd-notice__text">
                  <strong>Привяжите Email</strong> — чтобы восстановить доступ и получать чеки
                </div>
                <span className="rd-notice__action">Привязать →</span>
              </div>
            )}

            <div className="rd-cab__section-title">Мои подписки</div>

            {loading && <div className="rd-cab__hint">Загрузка…</div>}
            {!loading && error && (
              <div className="rd-cab__hint">
                Ошибка: {error}{' '}
                <button type="button" className="rd-link-btn" onClick={reload}>
                  Повторить
                </button>
              </div>
            )}

            {!loading && !error && (
              <div className="rd-cab__subs">
                {subs.map((sub) => (
                  <SubscriptionCard
                    key={sub.uuid}
                    sub={sub}
                    busy={busy}
                    onRenew={() => handleRenew(sub)}
                    onConnect={() => setConfigSub(sub)}
                  />
                ))}

                <button type="button" className="rd-sub-create" onClick={handleAdd} disabled={busy}>
                  <span className="rd-sub-create__ic">
                    <IconPlus size={24} />
                  </span>
                  <span className="rd-sub-create__title">Создать подписку</span>
                  <span className="rd-sub-create__sub">
                    Новый тариф или сервер для другого устройства
                  </span>
                </button>
              </div>
            )}

            <div className="rd-support-block">
              <div className="rd-support-block__head">
                <span className="rd-cab__section-title">Поддержка</span>
              </div>
              <div className="rd-support-tiles">
                <button
                  type="button"
                  className="rd-support-tile"
                  onClick={() => setActive('support')}
                >
                  <span className="rd-support-tile__ic">
                    <IconPlus size={18} />
                  </span>
                  <span className="rd-support-tile__text">
                    <span className="rd-support-tile__title">Новое обращение</span>
                    <span className="rd-support-tile__sub">Связаться с поддержкой</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="rd-support-tile"
                  onClick={() => setShowInstall(true)}
                >
                  <span className="rd-support-tile__ic rd-support-tile__ic--q">?</span>
                  <span className="rd-support-tile__text">
                    <span className="rd-support-tile__title">Инструкция по установке</span>
                    <span className="rd-support-tile__sub">Пошаговое руководство</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="rd-support-tile"
                  onClick={() => setShowInstall(true)}
                >
                  <span className="rd-support-tile__ic">
                    <IconMonitor size={18} />
                  </span>
                  <span className="rd-support-tile__text">
                    <span className="rd-support-tile__title">Установка на устройстве</span>
                    <span className="rd-support-tile__sub">Windows · macOS · iOS</span>
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {configSub && (
        <ConfigModal sub={configSub} title="Подключить подписку" onClose={() => setConfigSub(null)} />
      )}
      {showInstall && (
        <InstallModal subscriptionUrl={subs[0]?.subscription_url} onClose={() => setShowInstall(false)} />
      )}
      {showPayments && <PaymentsModal onClose={() => setShowPayments(false)} />}
      {showHowToPay && <HowToPayModal onClose={() => setShowHowToPay(false)} />}
    </div>
  )
}
