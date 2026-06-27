import { Link } from 'react-router-dom'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'

type Props = {
  active?: 'home' | 'pricing'
}

const LINKS: { key: Props['active']; label: string; to: string }[] = [
  { key: 'home', label: 'Главная', to: '/' },
  { key: 'pricing', label: 'Тарифы', to: '/pricing' },
]

export default function Nav({ active }: Props) {
  return (
    <header className="rd-nav">
      <div className="rd-container rd-nav__inner">
        <div className="rd-nav__left">
          <Brand />
          <nav className="rd-nav__links">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className={`rd-nav__link ${active === l.key ? 'is-active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="rd-nav__right">
          <ThemeToggle />
          <Link to="/login" className="rd-nav__signin">
            Войти
          </Link>
          <Link to="/register" className="rd-btn rd-btn--primary rd-nav__cta">
            Попробовать
          </Link>
        </div>
      </div>
    </header>
  )
}
