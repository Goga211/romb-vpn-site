import { IconGlobe } from '../icons'

// Демонстрационная «живая» панель статуса соединения из дизайна: индикатор
// «Защищено», график скорости, плитки характеристик и аптайм. Данные витринные.
export default function HeroPanel() {
  return (
    <div className="rd-hpanel">
      <div className="rd-hpanel__head">
        <div className="rd-hpanel__status">
          <span className="rd-hpanel__dot" />
          <span className="rd-hpanel__status-text">Защищено</span>
        </div>
        <div className="rd-hpanel__loc">
          <IconGlobe size={15} />
          Амстердам · NL
        </div>
      </div>

      <div className="rd-hpanel__graph">
        <div className="rd-hpanel__graph-head">
          <span className="rd-hpanel__muted">Скорость сейчас</span>
          <span className="rd-hpanel__speed rd-display">940 Мбит/с</span>
        </div>
        <svg viewBox="0 0 320 70" preserveAspectRatio="none" className="rd-hpanel__svg">
          <defs>
            <linearGradient id="rdSpark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--d-accent)" stopOpacity="0.34" />
              <stop offset="1" stopColor="var(--d-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,48 30,40 60,44 90,26 120,32 150,18 180,28 210,14 240,22 270,10 300,18 320,12 L320,70 L0,70 Z"
            fill="url(#rdSpark)"
          />
          <polyline
            points="0,48 30,40 60,44 90,26 120,32 150,18 180,28 210,14 240,22 270,10 300,18 320,12"
            fill="none"
            stroke="var(--d-accent)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="rd-hpanel__tiles">
        {[
          { label: 'Скорость', value: '1 Гбит/с' },
          { label: 'Устройства', value: '3' },
          { label: 'Трафик', value: '100 ГБ' },
          { label: 'Логи', value: 'Не ведём' },
        ].map((t) => (
          <div key={t.label} className="rd-hpanel__tile">
            <div className="rd-hpanel__muted">{t.label}</div>
            <div className="rd-hpanel__tile-val rd-display">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="rd-hpanel__uptime">
        <div className="rd-hpanel__uptime-head">
          <span className="rd-hpanel__muted">Аптайм за 90 дней</span>
          <span className="rd-hpanel__uptime-val">99.9%</span>
        </div>
        <div className="rd-hpanel__bar">
          <div className="rd-hpanel__bar-fill" style={{ width: '99%' }} />
        </div>
      </div>
    </div>
  )
}
