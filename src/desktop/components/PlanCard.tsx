import { Link } from 'react-router-dom'

export type Plan = {
  name: string
  price: string
  period?: string
  sub: string
  subAccent?: boolean
  features: string[]
  cta: string
  to: string
  popular?: boolean
}

export default function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={`rd-plan ${plan.popular ? 'rd-plan--popular' : ''}`}>
      {plan.popular && <span className="rd-plan__badge">ПОПУЛЯРНЫЙ</span>}
      <div className={`rd-plan__name ${plan.popular ? 'rd-accent' : ''}`}>{plan.name}</div>
      <div className="rd-plan__price">
        <span className="rd-plan__amount rd-display">{plan.price}</span>
        {plan.period && <span className="rd-plan__period">{plan.period}</span>}
      </div>
      <div className={`rd-plan__sub ${plan.subAccent ? 'rd-accent' : ''}`}>{plan.sub}</div>
      <ul className="rd-plan__features">
        {plan.features.map((f) => (
          <li key={f}>
            <span className="rd-plan__check">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={plan.to}
        className={`rd-btn rd-btn--block ${plan.popular ? 'rd-btn--primary' : 'rd-btn--ghost'}`}
      >
        {plan.cta}
      </Link>
    </div>
  )
}
