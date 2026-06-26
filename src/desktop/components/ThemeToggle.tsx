import { useTheme } from '../theme'
import { IconMoon, IconSun } from '../icons'

// Тумблер светлой/тёмной темы. Иконка показывает, КУДА переключит (антоним текущей).
export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="rd-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  )
}
