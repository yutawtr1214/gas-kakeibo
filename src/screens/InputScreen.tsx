import type React from 'react'
import type { ItemType } from '../lib/api/types'
import { Card } from '../components/Card'
import { FilterBar } from '../components/FilterBar'

type Member = { id: string; label: string }

type Props = {
  members: Member[]
  memberId: string
  setMemberId: (id: string) => void
  year: number
  setYear: (y: number) => void
  month: number
  setMonth: (m: number) => void
  busy: boolean
  loading: boolean
  itemTypeOptions: { value: ItemType; label: string }[]
  eventForm: {
    date: string
    item_type: ItemType | ''
    amount: string
    note: string
  }
  setEventForm: React.Dispatch<
    React.SetStateAction<{
      date: string
      item_type: ItemType | ''
      amount: string
      note: string
    }>
  >
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  onReload: () => void
}

export function InputScreen({
  members,
  memberId,
  setMemberId,
  year,
  setYear,
  month,
  setMonth,
  busy,
  loading,
  itemTypeOptions,
  eventForm,
  setEventForm,
  onSubmit,
  onReset,
  onReload,
}: Props) {
  return (
    <section className="stack">
      <FilterBar
        memberId={memberId}
        setMemberId={setMemberId}
        members={members}
        showMembers
        year={year}
        setYear={setYear}
        month={month}
        setMonth={setMonth}
        onReload={onReload}
        busy={busy || loading}
      />
      <Card title="イベント入力" subtitle="単発の収支や立替を登録">
        <form className="form" onSubmit={onSubmit}>
          <label>
            日付
            <input
              type="date"
              value={eventForm.date}
              onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
            />
          </label>
          <label>
            種別
            <select
              value={eventForm.item_type}
              onChange={(e) => setEventForm({ ...eventForm, item_type: e.target.value as ItemType })}
            >
              <option value="">選択してください</option>
              {itemTypeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            金額（円・整数）
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={eventForm.amount}
              onChange={(e) => setEventForm({ ...eventForm, amount: e.target.value })}
            />
          </label>
          <label>
            メモ（任意）
            <input
              type="text"
              value={eventForm.note}
              onChange={(e) => setEventForm({ ...eventForm, note: e.target.value })}
              placeholder="お店・用途など"
            />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? '送信中…' : '追加する'}
            </button>
            <button type="button" className="ghost" onClick={onReset} disabled={busy}>
              リセット
            </button>
          </div>
        </form>
      </Card>
    </section>
  )
}
