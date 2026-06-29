import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Payment, Subscription } from '../../lib/types'
import {
  RENEW_PERIOD,
  RENEW_PLAN_NAME,
  RENEW_PRICE_RUB,
  RENEW_PRICE_USD,
} from '../../data'
import SubscriptionWideCard from './SubscriptionWideCard'
import SubscriptionTermCard from './SubscriptionTermCard'
import DevicesPanel from './DevicesPanel'
import { IconPlus } from '../icons'

// --- Иконки (inline, единый стиль с DashboardHome) ---
const PATH = {
  check: 'M20 6 9 17l-5-5',
  card: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9.5h18M16 13.5h.01',
}

function Glyph({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

type Props = {
  subs: Subscription[]
  loading: boolean
  error: string | null
  busy: boolean
  onReload: () => void
  onActivateTrial: () => void
  onRenew: () => void
  onConnect: (sub: Subscription) => void
  onInstall: () => void
  onAllPayments: () => void
}

export default function SubscriptionsHome({
  subs,
  loading,
  error,
  busy,
  onReload,
  onActivateTrial,
  onRenew,
  onConnect,
  onInstall,
  onAllPayments,
}: Props) {
  const hasSubs = subs.length > 0
  const primary = subs[0]

  return (
    <>
      {/* --- Мои подписки --- */}
      <div className="rd-cab__section-title">Мои подписки</div>
      {loading && <div className="rd-cab__hint">Загрузка…</div>}
      {!loading && error && (
        <div className="rd-cab__hint">
          Ошибка: {error}{' '}
          <button type="button" className="rd-link-btn" onClick={onReload}>
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && hasSubs && primary && (
        <>
          {/* Широкая карточка + карточка «Срок действия» в одном ряду (по макету) */}
          <div className="rd-asub-row">
            <SubscriptionWideCard
              sub={primary}
              busy={busy}
              onRenew={onRenew}
              onConnect={() => onConnect(primary)}
            />
            <SubscriptionTermCard sub={primary} />
          </div>

          {/* Прочие подписки (если их несколько) */}
          {subs.length > 1 && (
            <div className="rd-asub-list">
              {subs.slice(1).map((sub) => (
                <SubscriptionWideCard
                  key={sub.uuid}
                  sub={sub}
                  busy={busy}
                  onRenew={onRenew}
                  onConnect={() => onConnect(sub)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && !hasSubs && (
        <div className="rd-asub-list">
          <button
            type="button"
            className="rd-sub-create"
            onClick={onActivateTrial}
            disabled={busy}
          >
            <span className="rd-sub-create__ic">
              <IconPlus size={24} />
            </span>
            <span className="rd-sub-create__title">Активировать пробный период</span>
            <span className="rd-sub-create__sub">7 дней полного доступа без оплаты</span>
          </button>
        </div>
      )}

      {/* --- Тариф (один, ручное продление) --- */}
      <div className="rd-cab__section-title">Тариф</div>
      <TariffCard primary={primary} busy={busy} onRenew={onRenew} />

      {/* --- Устройства + история платежей --- */}
      <div className="rd-dash__row">
        <DevicesPanel primary={primary} onInstall={onInstall} onReload={onReload} />
        <PaymentHistoryPanel onAllPayments={onAllPayments} />
      </div>
    </>
  )
}

// --------------------------------------------------------------------------- //
// Карточка тарифа (единственный реальный тариф продукта)                       //
// --------------------------------------------------------------------------- //
function TariffCard({
  primary,
  busy,
  onRenew,
}: {
  primary: Subscription | undefined
  busy: boolean
  onRenew: () => void
}) {
  const isCurrent = primary != null && !primary.expired
  const deviceFeature =
    primary == null || primary.device_limit === 0
      ? 'Безлимит устройств'
      : `До ${primary.device_limit} устройств`

  const feats = ['Безлимитный трафик', deviceFeature, 'Все локации и серверы']

  return (
    <div className="rd-tariff">
      <div className="rd-tariff__head">
        <div className="rd-tariff__name">{RENEW_PLAN_NAME}</div>
        {isCurrent && <span className="rd-tariff__badge">Текущий тариф</span>}
      </div>

      <div className="rd-tariff__price">
        <span className="rd-tariff__amount">{RENEW_PRICE_USD}</span>
        <span className="rd-tariff__per">/ {RENEW_PERIOD}</span>
      </div>
      <div className="rd-tariff__rub">≈ {RENEW_PRICE_RUB} за период</div>

      <ul className="rd-tariff__feats">
        {feats.map((f) => (
          <li key={f}>
            <span className="rd-tariff__feat-ic">
              <Glyph d={PATH.check} size={15} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className="rd-tariff__note">
        Оплата — переводом, активация вручную за несколько минут. Детали — в «Как оплатить».
      </div>

      <button
        type="button"
        className="rd-btn rd-btn--primary rd-tariff__cta"
        onClick={onRenew}
        disabled={busy}
      >
        Продлить подписку
      </button>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// История платежей                                                            //
// --------------------------------------------------------------------------- //
function PaymentHistoryPanel({ onAllPayments }: { onAllPayments: () => void }) {
  const [payments, setPayments] = useState<Payment[] | null>(null)

  useEffect(() => {
    let alive = true
    api
      .payments()
      .then((res) => alive && setPayments(res.payments))
      .catch(() => alive && setPayments([]))
    return () => {
      alive = false
    }
  }, [])

  const list = payments ?? []

  return (
    <div className="rd-panel">
      <div className="rd-panel__head">
        <h2 className="rd-panel__title">История платежей</h2>
        <button type="button" className="rd-link-btn" onClick={onAllPayments}>
          Все платежи
        </button>
      </div>

      {payments === null ? (
        <div className="rd-panel__empty">Загрузка…</div>
      ) : list.length === 0 ? (
        <div className="rd-panel__empty">Платежей пока нет</div>
      ) : (
        <div className="rd-pay">
          {list.slice(0, 5).map((p) => (
            <div key={p.id} className="rd-pay__row">
              <span className={`rd-pay__ic rd-pay__ic--${p.status}`}>
                <Glyph d={p.status === 'ok' ? PATH.check : PATH.card} size={16} />
              </span>
              <div className="rd-pay__name">
                <div className="rd-pay__title">{p.title}</div>
                <div className="rd-pay__date">{p.date}</div>
              </div>
              <div className="rd-pay__right">
                <div className="rd-pay__amount">{p.amount}</div>
                <div className={`rd-pay__status rd-pay__status--${p.status}`}>
                  {p.status === 'ok' ? 'Оплачено' : p.status === 'pending' ? 'В обработке' : 'Ошибка'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
