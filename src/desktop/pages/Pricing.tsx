import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import PlanCard, { type Plan } from '../components/PlanCard'
import { IconZap } from '../icons'

const PLANS: Plan[] = [
  {
    name: 'Пробный',
    price: '0 ₽',
    sub: '7 дней полного доступа',
    features: ['1 устройство', '10 ГБ трафика', 'Без привязки карты'],
    cta: 'Начать бесплатно',
    to: '/register',
  },
  {
    name: 'Pro',
    price: '199 ₽',
    period: '/ мес',
    sub: 'Всё, что нужно каждый день',
    features: ['3 устройства', '100 ГБ трафика', 'Скорость до 1 Гбит/с', 'Приоритетная поддержка'],
    cta: 'Выбрать Pro',
    to: '/register',
    popular: true,
  },
  {
    name: 'Полгода',
    price: '1500 ₽',
    period: '/ 6 мес',
    sub: '250 ₽ в месяц — выгоднее',
    subAccent: true,
    features: ['3 устройства', '100 ГБ трафика', 'Скорость до 1 Гбит/с'],
    cta: 'Выбрать',
    to: '/register',
  },
]

const INCLUDED = ['Без логов', 'Серверы в 20+ странах', 'Поддержка 24/7', 'Отмена в любой момент']

export default function Pricing() {
  return (
    <div className="rd-page">
      <Nav active="pricing" />

      <main>
        <section className="rd-pricing">
          <div className="rd-container">
            <div className="rd-pricing__head">
              <span className="rd-badge">
                <span className="rd-badge__dot" /> 7 дней бесплатно на любом тарифе
              </span>
              <h1 className="rd-pricing__title rd-display">Простые тарифы</h1>
              <p className="rd-pricing__sub">Без скрытых платежей. Отмена в любой момент.</p>
            </div>

            <div className="rd-pricing__grid">
              {PLANS.map((p) => (
                <PlanCard key={p.name} plan={p} />
              ))}
            </div>

            <div className="rd-included">
              <span className="rd-included__label">Во всех тарифах:</span>
              {INCLUDED.map((i) => (
                <span key={i} className="rd-included__item">
                  <span className="rd-plan__check">✓</span>
                  {i}
                </span>
              ))}
            </div>

            <div className="rd-cta rd-cta--soft">
              <div>
                <h2 className="rd-cta__title rd-display">Не уверены, какой выбрать?</h2>
                <p className="rd-cta__sub">Попробуйте 7 дней бесплатно — без карты.</p>
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
