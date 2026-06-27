import Brand from './Brand'
import { CHANNEL_URL } from '../../data'
import {
  IconCard,
  IconHome,
  IconLogout,
  IconSubscriptions,
  IconSupport,
  IconUser,
} from '../icons'

export type Section = 'home' | 'subscriptions' | 'support' | 'payments'
export type ProfileAction =
  | 'promo'
  | 'news'
  | 'channel'
  | 'referral'
  | 'faq'
  | 'privacy'
  | 'terms'

type Props = {
  active: Section
  onNavigate: (section: Section) => void
  onProfileAction: (action: ProfileAction) => void
  displayName: string
  subtitle: string
  onLogout: () => void
}

const NAV: { key: Section; label: string; icon: JSX.Element }[] = [
  { key: 'home', label: 'Главная', icon: <IconHome size={19} /> },
  { key: 'subscriptions', label: 'Подписки', icon: <IconSubscriptions size={19} /> },
  { key: 'support', label: 'Поддержка', icon: <IconSupport size={19} /> },
  { key: 'payments', label: 'Платежи', icon: <IconCard size={19} /> },
]

// soon — фича ещё не готова (промокод/рефералка требуют бэкенда): рендерим, но
// неактивной, чтобы кнопка не выглядела рабочей.
const PROFILE_LINKS: { label: string; action: ProfileAction; soon?: boolean }[] = [
  { label: 'Промокод', action: 'promo' },
  { label: 'Новости', action: 'news' },
  { label: 'Канал', action: 'channel' },
  { label: 'Реферальная', action: 'referral' },
  { label: 'Частые вопросы', action: 'faq' },
  { label: 'Политика', action: 'privacy' },
  { label: 'Соглашение', action: 'terms' },
]

export default function Sidebar({
  active,
  onNavigate,
  onProfileAction,
  displayName,
  subtitle,
  onLogout,
}: Props) {
  return (
    <aside className="rd-sidebar">
      <div className="rd-sidebar__brand">
        <Brand size={21} />
      </div>

      <nav className="rd-sidebar__nav">
        {NAV.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`rd-sidebar__item ${active === item.key ? 'is-active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="rd-sidebar__ic">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="rd-sidebar__profile">
        <div className="rd-sidebar__profile-title">Профиль</div>
        {PROFILE_LINKS.filter((link) => link.action !== 'channel' || CHANNEL_URL).map((link) => (
          <button
            key={link.action}
            type="button"
            className="rd-sidebar__item rd-sidebar__item--sm"
            disabled={link.soon}
            title={link.soon ? 'Скоро' : undefined}
            onClick={() => !link.soon && onProfileAction(link.action)}
          >
            {link.label}
            {link.soon && <span className="rd-sidebar__soon">скоро</span>}
          </button>
        ))}
      </div>

      <div className="rd-sidebar__foot">
        <div className="rd-sidebar__user">
          <span className="rd-sidebar__avatar">
            <IconUser size={18} />
          </span>
          <div className="rd-sidebar__user-info">
            <div className="rd-sidebar__user-name">{displayName}</div>
            <div className="rd-sidebar__user-sub">{subtitle}</div>
          </div>
        </div>
        <button type="button" className="rd-sidebar__logout" onClick={onLogout} aria-label="Выйти">
          <IconLogout size={18} />
        </button>
      </div>
    </aside>
  )
}
