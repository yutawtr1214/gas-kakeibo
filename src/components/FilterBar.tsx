import React from 'react'

type Member = { id: string; label: string }

type Props = {
  memberId?: string
  setMemberId?: (id: string) => void
  members?: Member[]
  showMembers?: boolean
  year: number
  setYear: (y: number) => void
  month: number
  setMonth: (m: number) => void
  onReload: () => void
  busy: boolean
}

export function FilterBar({
  memberId,
  setMemberId,
  members,
  showMembers = true,
  year,
  setYear,
  month,
  setMonth,
  onReload,
  busy,
}: Props) {
  return (
    <div className="filter-bar">
      {showMembers && members && memberId && setMemberId && (
        <div className="chip-group" role="group" aria-label="メンバー">
          {members.map((m) => (
            <button
              key={m.id}
              className={`chip ${memberId === m.id ? 'is-active' : ''}`}
              onClick={() => setMemberId(m.id)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div className="period">
        <input type="number" value={year} min={2000} onChange={(e) => setYear(Number(e.target.value))} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
        <button className="ghost small" onClick={onReload} disabled={busy}>
          再読込
        </button>
      </div>
    </div>
  )
}
