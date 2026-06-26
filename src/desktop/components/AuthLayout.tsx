import { type ReactNode } from 'react'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'

type Props = {
  children: ReactNode
}

// Минималистичный экран входа из дизайна: бренд в углу, мягкое радиальное свечение,
// карточка по центру.
export default function AuthLayout({ children }: Props) {
  return (
    <div className="rd-auth">
      <div className="rd-auth__top">
        <Brand size={20} />
        <ThemeToggle />
      </div>
      <div className="rd-auth__card">{children}</div>
    </div>
  )
}
