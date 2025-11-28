import type { ReactNode } from 'react'

type NavKey = string

type Props = {
  active: NavKey
  tabs: { key: NavKey; label: string; icon?: ReactNode }[]
  onChange: (key: NavKey) => void
}

export function BottomNav({ active, tabs, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="主要メニュー">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`nav-btn ${active === t.key ? 'is-active' : ''}`}
          onClick={() => onChange(t.key)}
          type="button"
          aria-current={active === t.key ? 'page' : undefined}
        >
          {t.icon && <span className="nav-icon" aria-hidden="true">{t.icon}</span>}
          <span className="nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
