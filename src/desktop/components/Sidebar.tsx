import Brand from './Brand'
import {
  IconCard,
  IconHome,
  IconLogout,
  IconSubscriptions,
  IconSupport,
  IconUser,
} from '../icons'

export type Section = 'home' | 'subscriptions' | 'support' | 'payments'

type Props = {
  active: Section
  onNavigate: (section: Section) => void
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

const PROFILE_LINKS = [
  'Промокод',
  'Новости',
  'Канал',
  'Реферальная',
  'Частые вопросы',
  'Политика',
  'Соглашение',
]

export default function Sidebar({ active, onNavigate, displayName, subtitle, onLogout }: Props) {
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
        {PROFILE_LINKS.map((label) => (
          <button key={label} type="button" className="rd-sidebar__item rd-sidebar__item--sm">
            {label}
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
