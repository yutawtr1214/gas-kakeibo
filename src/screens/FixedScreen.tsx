import React from 'react'
import type { ItemType, Recurrent } from '../lib/api/types'
import { Card } from '../components/Card'
import { FilterBar } from '../components/FilterBar'
import { TweetCard } from '../components/TweetCard'
import { PencilIcon, TrashIcon } from '../components/icons'

type Member = { id: string; label: string; avatar?: string }

type RecurrentFormState = {
  member_id: string
  item_type: ItemType | ''
  amount: string
  note: string
  start_y: number
  start_m: number
  end_y: string
  end_m: string
}

type Props = {
  members: Member[]
  memberId: string
  setMemberId: (id: string) => void
  year: number
  setYear: (y: number) => void
  month: number
  setMonth: (m: number) => void
  itemTypeOptions: { value: ItemType; label: string }[]
  recurrentForm: RecurrentFormState
  setRecurrentForm: React.Dispatch<React.SetStateAction<RecurrentFormState>>
  recurrents: Recurrent[]
  busy: boolean
  onSubmit: (e: React.FormEvent) => void
  onReset: () => void
  onDelete: (id: string, ownerId: string) => void
  onEdit: (r: Recurrent | null) => void
  editing: Recurrent | null
  onUpdate: (payload: { id: string; start_y: number; start_m: number; end_y: string | number | null; end_m: string | number | null }) => void
  onReload: () => void
}

export function FixedScreen({
  members,
  memberId,
  setMemberId,
  year,
  setYear,
  month,
  setMonth,
  itemTypeOptions,
  recurrentForm,
  setRecurrentForm,
  recurrents,
  busy,
  onSubmit,
  onReset,
  onDelete,
  onEdit,
  editing,
  onUpdate,
  onReload,
}: Props) {
  const [editState, setEditState] = React.useState({
    start_y: editing?.start_y || new Date().getFullYear(),
    start_m: editing?.start_m || new Date().getMonth() + 1,
    end_y: editing?.end_y ? String(editing.end_y) : '',
    end_m: editing?.end_m ? String(editing.end_m) : '',
  })

  // メンバー選択を入力タブと同様のチップで統一し、登録者に反映
  React.useEffect(() => {
    setRecurrentForm((prev) => ({ ...prev, member_id: memberId }))
  }, [memberId, setRecurrentForm])

  React.useEffect(() => {
    if (editing) {
      setEditState({
        start_y: editing.start_y,
        start_m: editing.start_m,
        end_y: editing.end_y ? String(editing.end_y) : '',
        end_m: editing.end_m ? String(editing.end_m) : '',
      })
    }
  }, [editing])

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    onUpdate({
      id: editing.id,
      start_y: Number(editState.start_y),
      start_m: Number(editState.start_m),
      end_y: editState.end_y === '' ? null : Number(editState.end_y),
      end_m: editState.end_m === '' ? null : Number(editState.end_m),
    })
  }

  return (
    <div className="stack">
      <FilterBar
        memberId={memberId}
        setMemberId={setMemberId}
        members={members}
        showMembers
        showPeriod={false}
        year={year}
        setYear={setYear}
        month={month}
        setMonth={setMonth}
        onReload={onReload}
        busy={busy}
      />
      <div className="grid">
      <Card title="固定費を登録" subtitle="毎月発生する支出を先に登録">
        <form className="form" onSubmit={onSubmit}>
          <label>
            種別
            <select
              value={recurrentForm.item_type}
              onChange={(e) =>
                setRecurrentForm({
                  ...recurrentForm,
                  item_type: e.target.value as ItemType,
                })
              }
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
              value={recurrentForm.amount}
              onChange={(e) => setRecurrentForm({ ...recurrentForm, amount: e.target.value })}
            />
          </label>
          <div className="inline">
            <label>
              開始年
              <input
                type="number"
                min={2000}
                value={recurrentForm.start_y}
                onChange={(e) => setRecurrentForm({ ...recurrentForm, start_y: Number(e.target.value) })}
              />
            </label>
            <label>
              開始月
              <select
                value={recurrentForm.start_m}
                onChange={(e) => setRecurrentForm({ ...recurrentForm, start_m: Number(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="inline">
            <label>
              終了年（任意）
              <input
                type="number"
                value={recurrentForm.end_y}
                onChange={(e) => setRecurrentForm({ ...recurrentForm, end_y: e.target.value })}
                placeholder="例: 2026"
              />
            </label>
            <label>
              終了月（任意）
              <select
                value={recurrentForm.end_m}
                onChange={(e) => setRecurrentForm({ ...recurrentForm, end_m: e.target.value })}
              >
                <option value="">未指定</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            メモ（任意）
            <input
              type="text"
              value={recurrentForm.note}
              onChange={(e) => setRecurrentForm({ ...recurrentForm, note: e.target.value })}
            />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? '送信中…' : '固定費を追加'}
            </button>
            <button type="button" className="ghost" onClick={onReset} disabled={busy}>
              リセット
            </button>
          </div>
        </form>
      </Card>

      <Card title="固定費一覧" subtitle="期間の編集が可能です">
        <div className="list">
          {recurrents.length === 0 && <p className="muted">登録された固定費はありません</p>}
          {recurrents.map((r) => (
            <div key={r.id}>
              <TweetCard
                members={members}
                memberId={r.member_id}
                name={members.find((m) => m.id === r.member_id)?.label || r.member_id}
                handle={r.member_id}
                headline={itemTypeOptions.find((i) => i.value === r.item_type)?.label || r.item_type}
                meta={`${r.start_y}/${r.start_m} 〜 ${r.end_y && r.end_m ? `${r.end_y}/${r.end_m}` : '継続'}`}
                body={r.note || ''}
                amountLabel={`${r.amount.toLocaleString()}円`}
                actions={[
                  {
                    key: 'edit',
                    label: '編集',
                    icon: <PencilIcon width={18} height={18} />,
                    onClick: () => onEdit(r),
                    tone: 'primary',
                    disabled: busy,
                  },
                  {
                    key: 'delete',
                    label: '削除',
                    icon: <TrashIcon width={18} height={18} />,
                    onClick: () => onDelete(r.id, r.member_id),
                    tone: 'danger',
                    disabled: busy,
                  },
                ]}
              />
            </div>
          ))}
        </div>
      </Card>

      {editing && (
        <Card
          title="固定費の期間を編集"
          subtitle={`${itemTypeOptions.find((i) => i.value === editing.item_type)?.label || editing.item_type} / ${
            members.find((m) => m.id === editing.member_id)?.label || editing.member_id
          }`}
        >
          <form className="form" onSubmit={handleUpdate}>
            <p className="muted">金額・種別は変更できません。終了月は当月以降を指定してください。</p>
            <div className="inline">
              <label>
                開始年
                <input
                  type="number"
                  min={2000}
                  value={editState.start_y}
                  onChange={(e) => setEditState({ ...editState, start_y: Number(e.target.value) })}
                />
              </label>
              <label>
                開始月
                <select
                  value={editState.start_m}
                  onChange={(e) => setEditState({ ...editState, start_m: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inline">
              <label>
                終了年（任意・当月以降）
                <input
                  type="number"
                  value={editState.end_y}
                  onChange={(e) => setEditState({ ...editState, end_y: e.target.value })}
                  placeholder="例: 2026"
                />
              </label>
              <label>
                終了月（任意）
                <select
                  value={editState.end_m}
                  onChange={(e) => setEditState({ ...editState, end_m: e.target.value })}
                >
                  <option value="">未指定</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="primary" disabled={busy}>
                {busy ? '送信中…' : '期間を更新'}
              </button>
              <button type="button" className="ghost" onClick={() => onEdit(null)} disabled={busy}>
                キャンセル
              </button>
            </div>
          </form>
        </Card>
      )}
      </div>
    </div>
  )
}
