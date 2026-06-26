// Тонкие stroke-иконки (lucide-стиль), как в дизайн-макете. Цвет наследуется
// через stroke="currentColor", размер — через проп size.

type IconProps = {
  size?: number
  className?: string
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export function IconHome({ size = 19, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 11l9-8 9 8M5 10v9h14v-9" />
    </svg>
  )
}

export function IconCard({ size = 19, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

export function IconSubscriptions({ size = 19, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

export function IconSupport({ size = 19, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  )
}

export function IconZap({ size = 19, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 13s2-7 9-7c0 7-7 9-7 9zM5 13l-2 6 6-2M9 11l4 4" />
    </svg>
  )
}

export function IconMail({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export function IconLock({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function IconUser({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 20a8 8 0 0 1 16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  )
}

export function IconPlus({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconGlobe({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 0 0 18 14 14 0 0 0 0-18" />
    </svg>
  )
}

export function IconMonitor({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 20h10" />
    </svg>
  )
}

export function IconSun({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function IconMoon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

export function IconLogout({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}
