import { Link } from 'react-router-dom'
import Brand from './Brand'

export default function Footer() {
  return (
    <footer className="rd-footer">
      <div className="rd-container rd-footer__inner">
        <div className="rd-footer__brand">
          <Brand size={20} />
          <p className="rd-footer__tagline">Быстрый и защищённый интернет на любом устройстве.</p>
        </div>
        <div className="rd-footer__cols">
          <div className="rd-footer__col">
            <span className="rd-footer__title">Продукт</span>
            <Link to="/pricing">Тарифы</Link>
            <Link to="/#features">Возможности</Link>
            <Link to="/register">Попробовать</Link>
          </div>
          <div className="rd-footer__col">
            <span className="rd-footer__title">Поддержка</span>
            <Link to="/#support">Помощь</Link>
            <Link to="/#faq">FAQ</Link>
            <Link to="/login">Войти</Link>
          </div>
        </div>
      </div>
      <div className="rd-container rd-footer__bottom">
        <span>© {new Date().getFullYear()} Romb VPN</span>
        <span>Сделано для свободного интернета</span>
      </div>
    </footer>
  )
}
