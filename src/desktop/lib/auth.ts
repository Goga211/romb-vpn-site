import type { SessionInfo } from '../hooks/useSession'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

async function post(path: string, body?: unknown): Promise<SessionInfo> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Ошибка запроса')
  }
  return (await res.json()) as SessionInfo
}

export function register(email: string, password: string): Promise<SessionInfo> {
  return post('/api/auth/register', { email, password })
}

export function login(email: string, password: string): Promise<SessionInfo> {
  return post('/api/auth/login', { email, password })
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
}

// Запрос ссылки сброса пароля. Ответ всегда одинаков (анти-энумерация e-mail).
export async function requestPasswordReset(email: string): Promise<void> {
  await post('/api/auth/forgot-password', { email })
}

// Установка нового пароля по токену из письма. Бросает при недействительном токене.
export async function resetPassword(token: string, password: string): Promise<void> {
  await post('/api/auth/reset-password', { token, password })
}
