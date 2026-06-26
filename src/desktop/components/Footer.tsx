import { Link } from 'react-router-dom'
import Brand from './Brand'

// Минималистичный футер: бренд, юридические ссылки, реквизиты оператора (152-ФЗ).
// Реквизиты в [скобках] оператор обязан заменить на свои настоящие данные.
export default function Footer() {
  return (
    <footer className="rd-footer">
      <div className="rd-container rd-footer__bar">
        <Brand size={18} />
        <div className="rd-footer__links">
          <Link to="/privacy">Политика конфиденциальности</Link>
          <Link to="/terms">Пользовательское соглашение</Link>
          <Link to="/pricing">Тарифы</Link>
        </div>
        <span className="rd-footer__copy">© {new Date().getFullYear()} Romb</span>
      </div>
      <div className="rd-container rd-footer__legal">
        Оператор персональных данных: [Наименование оператора], ИНН [__________].
        Связь: [email@romb.app].
      </div>
    </footer>
  )
}
