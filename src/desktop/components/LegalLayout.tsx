import type { ReactNode } from 'react'
import Nav from './Nav'
import Footer from './Footer'

type Props = {
  title: string
  updated: string
  children: ReactNode
}

// Общий каркас для юридических страниц (политика, соглашение, оферта).
// Узкая колонка с типографикой документа — переиспользуют Privacy и Terms.
export default function LegalLayout({ title, updated, children }: Props) {
  return (
    <div className="rd-page">
      <Nav />

      <main>
        <section className="rd-legal">
          <div className="rd-container rd-legal__inner">
            <header className="rd-legal__head">
              <h1 className="rd-legal__title rd-display">{title}</h1>
              <p className="rd-legal__meta">Редакция от {updated}</p>
            </header>
            <div className="rd-legal__body">{children}</div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
