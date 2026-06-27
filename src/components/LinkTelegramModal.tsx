import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { IconClose, IconSend } from '../icons'

// Десктоп: привязка Telegram к e-mail-аккаунту. Жмём кнопку → бэк даёт deep-link
// на бота → открываем его → пользователь подтверждает в Telegram → бот зовёт
// внутренний endpoint API. Здесь опрашиваем /api/me (через onReload), пока
// telegramLinked не станет true.
type Props = {
  telegramLinked: boolean
  onReload: () => void
  onClose: () => void
}

export default function LinkTelegramModal({ telegramLinked, onReload, onClose }: Props) {
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.startTelegramLink()
      setDeepLink(res.deep_link)
      window.open(res.deep_link, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Пока ждём подтверждения из бота — опрашиваем статус каждые 3 секунды.
  useEffect(() => {
    if (!deepLink || telegramLinked) return
    const id = setInterval(onReload, 3000)
    return () => clearInterval(id)
  }, [deepLink, telegramLinked, onReload])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal--config" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="close">
          <IconClose size={22} />
        </button>
        <span className="modal__icon">
          <IconSend size={32} />
        </span>
        <div className="modal__title" style={{ fontSize: 22 }}>
          Привязка Telegram
        </div>

        {telegramLinked ? (
          <>
            <div className="modal__sub">
              Telegram привязан. Подписка из Telegram теперь доступна и здесь, в кабинете.
            </div>
            <button className="btn btn-primary" onClick={onClose}>
              Готово
            </button>
          </>
        ) : (
          <>
            <div className="modal__sub">
              Откройте бота и нажмите «Запустить» — мы привяжем ваш Telegram к этому
              аккаунту, и подписка станет общей.
            </div>

            {error && <div className="cfg-error">{error}</div>}

            <button className="btn btn-primary" onClick={start} disabled={busy}>
              {busy ? 'Готовим ссылку…' : deepLink ? 'Открыть бота снова' : 'Открыть бота'}
            </button>

            {deepLink && (
              <div className="modal__sub" style={{ marginTop: 12 }}>
                Ждём подтверждения в Telegram…
              </div>
            )}

            <button className="btn-text" onClick={onClose}>
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  )
}
