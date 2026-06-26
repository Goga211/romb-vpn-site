import App from './App'
import DesktopApp from './desktop/DesktopApp'
import { getInitData } from './lib/telegram'

// Диспетчер поверхностей: внутри Telegram (есть подписанный initData) показываем
// мобильный мини-апп как есть; в обычном браузере — десктопный сайт с входом по
// e-mail. Решение принимается один раз на старте — контекст за время сессии не
// меняется (Telegram WebView либо есть, либо нет).
export default function RootApp() {
  const isTelegram = getInitData() !== ''
  return isTelegram ? <App /> : <DesktopApp />
}
