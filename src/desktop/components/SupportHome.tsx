import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { usePolling } from '../../hooks/usePolling'
import { faqItems, supportChannels, FAQ_URL } from '../../data'
import { statusLabel } from '../../lib/ticket'
import type { ServerNode, Ticket, TicketListResponse } from '../../lib/types'
import SupportModal from '../../components/SupportModal'
import TicketThread from '../../components/TicketThread'
import AdminSupportScreen from '../../screens/AdminSupportScreen'

const POLL_MS = 8000

// --- Иконки (inline SVG, как в DashboardHome — совпадают с макетом) ---
function Glyph({ d, size = 20 }: { d: string; size?: number }) {
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

const PATH = {
  clock: 'M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  chat: 'M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z',
  check: 'M20 6 9 17l-5-5',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 6h13l3.5 6v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6z',
  plus: 'M12 5v14M5 12h14',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  send: 'M21 4 3 11l6 2m12-9-9 16-3-7m12-9-9 9',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
}

const CHANNEL_GLYPH = { send: PATH.send, mail: PATH.mail } as const

function fmtAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} дн назад`
}

const badgeTone: Record<Ticket['status'], string> = {
  answered: 'rd-sup__badge--ok',
  open: 'rd-sup__badge--wait',
  closed: 'rd-sup__badge--muted',
}

type Props = {
  isAdmin?: boolean
}

export default function SupportHome({ isAdmin = false }: Props) {
  const [scope, setScope] = useState<'mine' | 'admin'>('mine')
  const [tab, setTab] = useState<'open' | 'history'>('open')
  const [openId, setOpenId] = useState<number | null>(null)
  const [showSupport, setShowSupport] = useState(false)

  const { data, loading, error, refresh } = usePolling<TicketListResponse>(
    () => api.myTickets(),
    POLL_MS,
    scope === 'mine' && openId === null,
  )

  const tickets = data?.tickets ?? []
  const active = tickets.filter((t) => t.status !== 'closed')
  const history = tickets.filter((t) => t.status === 'closed')
  const shown = tab === 'open' ? active : history

  // Открытый тред поверх всего (в читаемой колонке).
  if (scope === 'mine' && openId !== null) {
    return (
      <div className="rd-cab__support">
        <TicketThread
          ticketId={openId}
          role="user"
          onClose={() => {
            setOpenId(null)
            void refresh()
          }}
        />
      </div>
    )
  }

  return (
    <>
      {isAdmin && (
        <div className="rd-sup__scope">
          <button
            type="button"
            className={scope === 'mine' ? 'is-active' : ''}
            onClick={() => setScope('mine')}
          >
            Мои обращения
          </button>
          <button
            type="button"
            className={scope === 'admin' ? 'is-active' : ''}
            onClick={() => setScope('admin')}
          >
            Заявки
          </button>
        </div>
      )}

      {scope === 'admin' ? (
        <div className="rd-cab__support">
          <AdminSupportScreen />
        </div>
      ) : (
        <>
          <StatStrip openCount={active.length} resolved={history.length} total={tickets.length} />

          <div className="rd-sup__grid">
            <div className="rd-sup__col">
              <NewRequestHero onWrite={() => setShowSupport(true)} />

              <div className="rd-panel">
                <div className="rd-panel__head">
                  <h2 className="rd-panel__title">Мои обращения</h2>
                  <div className="rd-sup__tabs">
                    <button
                      type="button"
                      className={tab === 'open' ? 'is-active' : ''}
                      onClick={() => setTab('open')}
                    >
                      Открытые
                    </button>
                    <button
                      type="button"
                      className={tab === 'history' ? 'is-active' : ''}
                      onClick={() => setTab('history')}
                    >
                      История
                    </button>
                  </div>
                </div>

                {error && <div className="rd-panel__empty">Ошибка: {error}</div>}

                {shown.length > 0 ? (
                  <div className="rd-sup__tickets">
                    {shown.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="rd-sup__ticket"
                        onClick={() => setOpenId(t.id)}
                      >
                        <span className="rd-sup__ticket-ic">
                          <Glyph d={PATH.chat} size={20} />
                        </span>
                        <span className="rd-sup__ticket-body">
                          <span className="rd-sup__ticket-top">
                            <span className="rd-sup__ticket-title">Обращение #{t.id}</span>
                          </span>
                          {t.last_message && (
                            <span className="rd-sup__ticket-last">
                              {t.last_author === 'admin' ? 'Поддержка: ' : ''}
                              {t.last_message}
                            </span>
                          )}
                        </span>
                        <span className="rd-sup__ticket-meta">
                          <span className={`rd-sup__badge ${badgeTone[t.status]}`}>
                            {statusLabel[t.status]}
                          </span>
                          <span className="rd-sup__ticket-time">{fmtAgo(t.updated_at)}</span>
                        </span>
                        <span className="rd-sup__ticket-chev">
                          <Glyph d={PATH.chevronRight} size={18} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  !loading && (
                    <div className="rd-sup__empty">
                      <span className="rd-sup__empty-ic">
                        <Glyph d={PATH.chat} size={32} />
                      </span>
                      <div>
                        <div className="rd-sup__empty-title">
                          {tab === 'open' ? 'Нет открытых обращений' : 'История обращений пуста'}
                        </div>
                        <div className="rd-sup__empty-sub">
                          Здесь появятся ваши диалоги с поддержкой. Большинство вопросов
                          решается в FAQ справа.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rd-btn rd-btn--primary"
                        onClick={() => setShowSupport(true)}
                      >
                        Создать обращение
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rd-sup__col">
              <ChannelsPanel />
              <ServiceStatus />
              <FaqPanel />
            </div>
          </div>
        </>
      )}

      {showSupport && (
        <SupportModal
          onClose={() => {
            setShowSupport(false)
            void refresh()
          }}
        />
      )}
    </>
  )
}

// --------------------------------------------------------------------------- //
// Полоса статистики                                                           //
// --------------------------------------------------------------------------- //
function StatStrip({
  openCount,
  resolved,
  total,
}: {
  openCount: number
  resolved: number
  total: number
}) {
  const items = [
    { d: PATH.clock, value: 'неск. мин', label: 'Среднее время ответа' },
    { d: PATH.chat, value: String(openCount), label: 'Открытых обращений' },
    { d: PATH.check, value: String(resolved), label: 'Решено' },
    { d: PATH.inbox, value: String(total), label: 'Всего обращений' },
  ]
  return (
    <div className="rd-sup__stats">
      {items.map((s) => (
        <div key={s.label} className="rd-sup__stat">
          <span className="rd-sup__stat-ic">
            <Glyph d={s.d} size={21} />
          </span>
          <div>
            <div className="rd-sup__stat-val">{s.value}</div>
            <div className="rd-sup__stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Новое обращение                                                             //
// --------------------------------------------------------------------------- //
function NewRequestHero({ onWrite }: { onWrite: () => void }) {
  return (
    <div className="rd-sup__hero">
      <span className="rd-sup__hero-ic">
        <Glyph d={PATH.chat} size={26} />
      </span>
      <div className="rd-sup__hero-lead">
        <div className="rd-sup__hero-title">Новое обращение</div>
        <div className="rd-sup__hero-sub">
          Опишите проблему — оператор подключится в течение нескольких минут.
        </div>
      </div>
      <button type="button" className="rd-btn rd-btn--primary" onClick={onWrite}>
        <Glyph d={PATH.plus} size={16} /> Написать
      </button>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Каналы связи                                                                //
// --------------------------------------------------------------------------- //
function ChannelsPanel() {
  return (
    <div className="rd-panel">
      <div className="rd-panel__head">
        <h2 className="rd-panel__title">Каналы связи</h2>
      </div>
      <div className="rd-sup__channels">
        {supportChannels.map((c) => (
          <a
            key={c.id}
            className="rd-sup__channel"
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="rd-sup__channel-ic">
              <Glyph d={CHANNEL_GLYPH[c.icon]} size={20} />
            </span>
            <span className="rd-sup__channel-body">
              <span className="rd-sup__channel-name">{c.name}</span>
              <span className="rd-sup__channel-handle">{c.handle}</span>
            </span>
            <span
              className={`rd-sup__pill ${c.pillTone === 'online' ? 'rd-sup__pill--ok' : 'rd-sup__pill--muted'}`}
            >
              {c.pill}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Статус сервиса                                                              //
// --------------------------------------------------------------------------- //
function ServiceStatus() {
  const [servers, setServers] = useState<ServerNode[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .servers()
      .then((d) => alive && setServers(d.servers))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const serversOnline = (servers ?? []).some((s) => s.online)
  // VPN-серверы: реальный сигнал из /api/servers; остальные строки операционны,
  // раз кабинет отвечает (их падение проявилось бы отказом самой страницы).
  const vpn = failed
    ? { state: 'Нет данных', tone: 'muted' as const }
    : servers === null
      ? { state: 'Проверка…', tone: 'muted' as const }
      : serversOnline
        ? { state: 'Работают', tone: 'ok' as const }
        : { state: 'Серверов нет', tone: 'warn' as const }

  const rows = [
    { name: 'VPN-серверы', ...vpn },
    { name: 'Личный кабинет', state: 'Работает', tone: 'ok' as const },
    { name: 'Оплата и биллинг', state: 'Работает', tone: 'ok' as const },
  ]
  const allOk = rows.every((r) => r.tone === 'ok')

  return (
    <div className="rd-panel">
      <div className="rd-panel__head">
        <h2 className="rd-panel__title">Статус сервиса</h2>
        <span className={`rd-sup__status-head ${allOk ? 'is-ok' : 'is-warn'}`}>
          <span className="rd-sup__status-dot" />
          {allOk ? 'Всё работает' : 'Есть нюансы'}
        </span>
      </div>
      <div className="rd-sup__status">
        {rows.map((r) => (
          <div key={r.name} className="rd-sup__status-row">
            <span className={`rd-sup__status-dot rd-sup__status-dot--${r.tone}`} />
            <span className="rd-sup__status-name">{r.name}</span>
            <span className={`rd-sup__status-state rd-sup__status-state--${r.tone}`}>
              {r.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// FAQ                                                                         //
// --------------------------------------------------------------------------- //
function FaqPanel() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="rd-panel">
      <div className="rd-panel__head">
        <h2 className="rd-panel__title">Частые вопросы</h2>
      </div>
      <div className="rd-sup__faq">
        {faqItems.map((f, i) => {
          const isOpen = openIndex === i
          return (
            <div key={f.q} className="rd-sup__faq-item">
              <button
                type="button"
                className="rd-sup__faq-q"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                aria-expanded={isOpen}
              >
                <span>{f.q}</span>
                <span className={`rd-sup__faq-chev ${isOpen ? 'is-open' : ''}`}>
                  <Glyph d={PATH.chevronDown} size={18} />
                </span>
              </button>
              {isOpen && <div className="rd-sup__faq-a">{f.a}</div>}
            </div>
          )
        })}
      </div>
      <a
        className="rd-sup__faq-all"
        href={FAQ_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Все вопросы <Glyph d={PATH.arrowRight} size={15} />
      </a>
    </div>
  )
}
