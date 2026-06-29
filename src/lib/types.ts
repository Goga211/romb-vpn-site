// Зеркало pydantic-схем бэкенда (snake_case как в JSON-ответе FastAPI).

export type Subscription = {
  id: string
  uuid: string
  label: string
  name: string
  status: string
  pro: boolean
  used_traffic_bytes: number
  traffic_limit_bytes: number
  traffic_text: string | null
  expire_at: string
  expire_text: string
  expired: boolean
  devices_used: number
  device_limit: number
  devices_text: string
  subscription_url: string
}

export type ServerNode = {
  name: string
  country: string
  country_code: string
  online: boolean
  users_online: number
  load: number // 0..100
}

export type ServerListResponse = {
  servers: ServerNode[]
}

export type TrafficPoint = {
  date: string // YYYY-MM-DD
  bytes: number
}

export type TrafficSeriesResponse = {
  points: TrafficPoint[]
  total_bytes: number
}

export type MeResponse = {
  telegram_id: number
  subscriptions: Subscription[]
  is_admin: boolean
  trial_days: number
  linked_email: string | null
  telegram_linked: boolean
}

export type ConfigResponse = {
  subscription_url: string
}

export type Payment = {
  id: string
  date: string
  amount: string
  title: string
  status: 'ok' | 'pending' | 'failed'
}

export type PaymentListResponse = {
  payments: Payment[]
}

export type PromoRedeemResponse = {
  ok: boolean
  bonus_days: number
}

export type ReferralInfoResponse = {
  link: string
  invited: number
  rewarded: number
  bonus_days: number
  goal: number
  goal_bonus_days: number
}

export type Device = {
  hwid: string
  platform: string
  device_model: string
  created_at: string | null
}

export type DeviceListResponse = {
  devices: Device[]
}

export type SupportResponse = {
  ok: boolean
  ticket_id: number
}

export type TicketStatus = 'open' | 'answered' | 'closed'

export type Ticket = {
  id: number
  status: TicketStatus
  created_at: string
  updated_at: string
  last_message: string | null
  last_author: 'user' | 'admin' | null
  // присутствует в админских ответах
  user_telegram_id?: number | null
  username?: string | null
  first_name?: string | null
}

export type TicketMessage = {
  id: number
  author: 'user' | 'admin'
  text: string
  created_at: string
  // путь защищённого эндпоинта с картинкой-вложением (фронт догружает с initData)
  attachment_url?: string | null
}

export type TicketDetail = Ticket & {
  messages: TicketMessage[]
}

export type TicketListResponse = {
  tickets: Ticket[]
}
