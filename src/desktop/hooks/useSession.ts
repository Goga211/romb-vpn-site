import { useCallback, useEffect, useState } from 'react'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export type SessionInfo = {
  authenticated: boolean
  kind: 'telegram' | 'email' | 'anon'
  email: string | null
  display_name: string | null
  account_id: number | null
}

const ANON: SessionInfo = {
  authenticated: false,
  kind: 'anon',
  email: null,
  display_name: null,
  account_id: null,
}

type State = {
  session: SessionInfo
  loading: boolean
  // true — последний результат пришёл как явный ответ сервера (true/false).
  // false — пока ни одного успешного ответа не было (только транзиентные ошибки),
  // поэтому «не залогинен» ещё НЕ подтверждён и выкидывать на /login рано.
  confirmed: boolean
}

// Кто сейчас вошёл на десктопе. Источник истины — серверная сессия в HttpOnly-cookie
// (её JS не читает), поэтому состояние тянем с бэкенда, а не из localStorage.
export function useSession() {
  const [state, setState] = useState<State>({ session: ANON, loading: true, confirmed: false })

  // silent=true — фоновая ре-валидация (focus/online/visibility): НЕ поднимаем
  // loading, иначе RequireAuth подменяет кабинет пустым экраном и тот размонтируется
  // (визуально «перезагрузка» + сброс вкладки на «Главную» при каждом возврате в окно).
  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setState((s) => ({ ...s, loading: true }))
    try {
      const res = await fetch(`${BASE}/api/auth/session`, { credentials: 'include' })
      if (!res.ok) throw new Error('session request failed')
      // Ответ сервера — единственный источник истины о статусе входа
      // (authenticated: true | false). Применяем его как есть и помечаем confirmed.
      const data = (await res.json()) as SessionInfo
      setState({ session: data, loading: false, confirmed: true })
    } catch {
      // Транзиентная ошибка сети/сервера (блип, рестарт бэкенда, оффлайн на миг)
      // — НЕ сбрасываем уже подтверждённую сессию в ANON, иначе RequireAuth
      // выкидывает пользователя на /login на ровном месте. Сохраняем последнее
      // известное состояние; confirmed не повышаем — реальный разлогин приходит
      // только как authenticated:false из успешного ответа выше.
      setState((s) => ({ session: s.session, loading: false, confirmed: s.confirmed }))
    }
  }, [])

  useEffect(() => {
    void reload()

    // Перепроверяем сессию при возврате на вкладку и восстановлении сети. Это и
    // продлевает sliding-сессию на бэке (активный юзер не протухает), и поднимает
    // вход обратно, если он отвалился из-за временной потери связи.
    const onWake = () => {
      if (document.visibilityState === 'visible') void reload({ silent: true })
    }
    window.addEventListener('focus', onWake)
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('focus', onWake)
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [reload])

  return { ...state, reload }
}
