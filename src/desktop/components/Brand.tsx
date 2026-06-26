import { Link } from 'react-router-dom'

type Props = {
  size?: number
  to?: string
}

// Логотип Romb: зелёная «o» в середине, шрифт Unbounded.
export default function Brand({ size = 21, to = '/' }: Props) {
  return (
    <Link to={to} className="rd-brand rd-display" style={{ fontSize: size }}>
      R<span className="rd-brand__o">o</span>mb
    </Link>
  )
}
