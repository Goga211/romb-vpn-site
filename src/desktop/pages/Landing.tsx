import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import HeroPanel from '../components/HeroPanel'
import { IconZap } from '../icons'

const PLATFORMS = ['Windows', 'macOS', 'iOS', 'Android', 'Linux']

export default function Landing() {
  return (
    <div className="rd-page">
      <Nav active="features" />

      <main>
        <section className="rd-hero">
          <div className="rd-container rd-hero__grid">
            <div className="rd-hero__copy">
              <h1 className="rd-hero__title rd-display">
                Быстрый и <span className="rd-accent">защищённый</span> интернет
              </h1>
              <p className="rd-hero__sub">
                Стабильное соединение и полная приватность на любом устройстве.
              </p>
              <div className="rd-hero__cta">
                <Link to="/register" className="rd-btn rd-btn--primary rd-btn--lg">
                  <IconZap size={19} /> Попробовать бесплатно
                </Link>
                <Link to="/login" className="rd-btn rd-btn--ghost rd-btn--lg">
                  Есть подписка
                </Link>
              </div>
              <p className="rd-hero__note">7 дней полного доступа — без карты</p>
            </div>
            <HeroPanel />
          </div>

          <div className="rd-container">
            <div className="rd-trust">
              <span className="rd-trust__label">Работает на</span>
              {PLATFORMS.map((p, i) => (
                <span key={p} className="rd-trust__item">
                  {i > 0 && <span className="rd-trust__dot">·</span>}
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
