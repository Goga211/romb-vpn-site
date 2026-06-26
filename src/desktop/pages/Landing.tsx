import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import HeroPanel from '../components/HeroPanel'
import { IconGlobe, IconLock, IconZap } from '../icons'

const PLATFORMS = ['Windows', 'macOS', 'iOS', 'Android', 'Linux']

const FEATURES = [
  {
    icon: <IconZap size={22} />,
    title: 'До 1 Гбит/с',
    text: 'Скоростные серверы без искусственных ограничений — стримы и загрузки летают.',
  },
  {
    icon: <IconLock size={22} />,
    title: 'Без логов',
    text: 'Мы не храним историю подключений. Ваш трафик остаётся только вашим.',
  },
  {
    icon: <IconGlobe size={22} />,
    title: '20+ стран',
    text: 'Серверы по всему миру — выбирайте лучший маршрут для любой задачи.',
  },
]

const FAQ = [
  {
    q: 'Нужна ли банковская карта для пробного периода?',
    a: 'Нет. 7 дней полного доступа активируются без привязки карты.',
  },
  {
    q: 'На скольких устройствах работает подписка?',
    a: 'На тарифе Pro — до 3 устройств одновременно: телефон, компьютер и планшет.',
  },
  {
    q: 'Какие платформы поддерживаются?',
    a: 'Windows, macOS, iOS, Android и Linux. Установка занимает пару минут.',
  },
  {
    q: 'Можно ли отменить в любой момент?',
    a: 'Да, подписка отменяется в один клик в личном кабинете без скрытых условий.',
  },
]

export default function Landing() {
  return (
    <div className="rd-page">
      <Nav active="features" />

      <main>
        {/* hero */}
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

        {/* features */}
        <section id="features" className="rd-section">
          <div className="rd-container">
            <h2 className="rd-section__title rd-display">Всё, что нужно для свободы в сети</h2>
            <p className="rd-section__sub">Без компромиссов между скоростью и приватностью.</p>
            <div className="rd-features">
              {FEATURES.map((f) => (
                <div key={f.title} className="rd-feature">
                  <span className="rd-feature__ic">{f.icon}</span>
                  <h3 className="rd-feature__title">{f.title}</h3>
                  <p className="rd-feature__text">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="rd-section">
          <div className="rd-container rd-faq">
            <div className="rd-faq__head">
              <h2 className="rd-section__title rd-display">Частые вопросы</h2>
              <p className="rd-section__sub">Коротко о главном перед стартом.</p>
            </div>
            <div className="rd-faq__list">
              {FAQ.map((item) => (
                <details key={item.q} className="rd-faq__item">
                  <summary className="rd-faq__q">{item.q}</summary>
                  <p className="rd-faq__a">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* support / CTA */}
        <section id="support" className="rd-section">
          <div className="rd-container">
            <div className="rd-cta">
              <div>
                <h2 className="rd-cta__title rd-display">Готовы попробовать?</h2>
                <p className="rd-cta__sub">7 дней бесплатно — без карты и обязательств.</p>
              </div>
              <Link to="/register" className="rd-btn rd-btn--primary rd-btn--lg">
                <IconZap size={18} /> Начать бесплатно
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
