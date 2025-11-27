import React from 'react'

type CardProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
  highlight?: boolean
}

export function Card({ title, subtitle, children, highlight }: CardProps) {
  return (
    <section className={`card ${highlight ? 'card-highlight' : ''}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}
