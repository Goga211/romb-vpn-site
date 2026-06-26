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
}

// Кто сейчас вошёл на десктопе. Источник истины — серверная сессия в HttpOnly-cookie
// (её JS не читает), поэтому состояние тянем с бэкенда, а не из localStorage.
export function useSession() {
  const [state, setState] = useState<State>({ session: ANON, loading: true })

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await fetch(`${BASE}/api/auth/session`, { credentials: 'include' })
      if (!res.ok) throw new Error('session request failed')
      const data = (await res.json()) as SessionInfo
      setState({ session: data, loading: false })
    } catch {
      setState({ session: ANON, loading: false })
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { ...state, reload }
}
