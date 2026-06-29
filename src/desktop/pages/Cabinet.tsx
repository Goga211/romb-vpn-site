import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar, { type Section, type ProfileAction } from '../components/Sidebar'
import DashboardHome from '../components/DashboardHome'
import SubscriptionsHome from '../components/SubscriptionsHome'
import ThemeToggle from '../components/ThemeToggle'
import { useSession } from '../hooks/useSession'
import { logout } from '../lib/auth'
import { IconPlus } from '../icons'
import { useSubscriptions } from '../../hooks/useSubscriptions'
import type { Subscription } from '../../lib/types'
import ConfigModal from '../../components/ConfigModal'
import InstallModal from '../../components/InstallModal'
import PaymentsModal from '../../components/PaymentsModal'
import HowToPayModal from '../../components/HowToPayModal'
import LinkTelegramModal from '../../components/LinkTelegramModal'
import PromoModal from '../../components/PromoModal'
import ReferralModal from '../../components/ReferralModal'
import NewsModal from '../../components/NewsModal'
import SupportHome from '../components/SupportHome'
import { CHANNEL_URL, FAQ_URL } from '../../data'

const TITLES: Record<Section, string> = {
  home: 'Главная',
  subscriptions: 'Подписки',
  support: 'Поддержка',
  payments: 'Платежи',
}

// Секции кабинета — реальные подмаршруты под /app, чтобы они были полноценными
// страницами: переживают обновление/возврат в окно, работают «назад/вперёд» и
// прямые ссылки. «Платежи» остаются модалкой (без своего URL).
const SECTION_PATHS: Record<Exclude<Section, 'payments'>, string> = {
  home: '/app',
  subscriptions: '/app/subscriptions',
  support: '/app/support',
}

function sectionFromPath(pathname: string): Section {
  if (pathname.startsWith('/app/subscriptions')) return 'subscriptions'
  if (pathname.startsWith('/app/support')) return 'support'
  return 'home'
}

export default function Cabinet() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useSession()
  const { subs, loading, error, reload, activateTrial, telegramLinked, isAdmin } = useSubscriptions()

  const active = sectionFromPath(location.pathname)
  const [busy, setBusy] = useState(false)
  const [configSub, setConfigSub] = useState<Subscription | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [showHowToPay, setShowHowToPay] = useState(false)
  const [showLinkTg, setShowLinkTg] = useState(false)
  const [showPromo, setShowPromo] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [showNews, setShowNews] = useState(false)

  const displayName = session.display_name || 'Аккаунт'
  const subtitle = session.email || 'Личный кабинет'

  const handleNavigate = (section: Section) => {
    if (section === 'payments') {
      setShowPayments(true)
      return
    }
    navigate(SECTION_PATHS[section])
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // Кнопки профиля: юр-страницы — внутренний роут, остальное — внешняя ссылка.
  // promo/referral помечены soon в Sidebar и сюда не доходят (фичи в разработке).
  const handleProfileAction = (action: ProfileAction) => {
    const external: Partial<Record<ProfileAction, string>> = {
      channel: CHANNEL_URL,
      faq: FAQ_URL,
    }
    if (action === 'privacy') navigate('/privacy')
    else if (action === 'terms') navigate('/terms')
    else if (action === 'promo') setShowPromo(true)
    else if (action === 'referral') setShowReferral(true)
    else if (action === 'news') setShowNews(true)
    else if (external[action]) window.open(external[action], '_blank', 'noopener,noreferrer')
  }

  // Один аккаунт = одна подписка в панели (ключ — telegram_id/remnawave_key), поэтому
  // «создать подписку» имеет смысл только когда подписок ещё нет — это активация триала.
  const hasSubs = subs.length > 0

  const handleActivateTrial = async () => {
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

  return (
    <div className="rd-cab">
      <Sidebar
        active={active}
        onNavigate={handleNavigate}
        onProfileAction={handleProfileAction}
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
            {!telegramLinked && (
              <button
                type="button"
                className="rd-btn rd-btn--ghost"
                onClick={() => setShowLinkTg(true)}
              >
                Привязать Telegram
              </button>
            )}
            {!hasSubs && (
              <button
                type="button"
                className="rd-btn rd-btn--primary"
                onClick={handleActivateTrial}
                disabled={busy}
              >
                <IconPlus size={18} /> Пробный период
              </button>
            )}
          </div>
        </div>

        {active === 'support' ? (
          <SupportHome isAdmin={isAdmin} />
        ) : active === 'home' ? (
          <DashboardHome
            subs={subs}
            loading={loading}
            error={error}
            busy={busy}
            onReload={reload}
            onActivateTrial={handleActivateTrial}
            onRenew={() => setShowHowToPay(true)}
            onConnect={(sub) => setConfigSub(sub)}
            onInstall={() => setShowInstall(true)}
            onHowToPay={() => setShowHowToPay(true)}
            onNewTicket={() => navigate(SECTION_PATHS.support)}
            onReferral={() => setShowReferral(true)}
          />
        ) : (
          <SubscriptionsHome
            subs={subs}
            loading={loading}
            error={error}
            busy={busy}
            onReload={reload}
            onActivateTrial={handleActivateTrial}
            onRenew={() => setShowHowToPay(true)}
            onConnect={(sub) => setConfigSub(sub)}
            onInstall={() => setShowInstall(true)}
            onAllPayments={() => setShowPayments(true)}
          />
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
      {showPromo && <PromoModal onClose={() => setShowPromo(false)} onApplied={reload} />}
      {showReferral && <ReferralModal onClose={() => setShowReferral(false)} />}
      {showNews && <NewsModal onClose={() => setShowNews(false)} />}
      {showLinkTg && (
        <LinkTelegramModal
          telegramLinked={telegramLinked}
          onReload={reload}
          onClose={() => setShowLinkTg(false)}
        />
      )}
    </div>
  )
}
