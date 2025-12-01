import { lazy, Suspense } from 'react'
import type { BalanceHistoryItem, Transfer, TransfersResult } from '../lib/api/types'
import { Card } from '../components/Card'
import { SummaryRow } from '../components/SummaryRow'
import { FilterBar } from '../components/FilterBar'

const BalanceChart = lazy(async () =>
  import('../components/BalanceChart').then((m) => ({ default: m.BalanceChart })),
)

type Member = { id: string; label: string }

type Props = {
  members: Member[]
  year: number
  setYear: (y: number) => void
  month: number
  setMonth: (m: number) => void
  busy: boolean
  loading: boolean
  recommendedTransferTotal: number
  transfersSummary: TransfersResult
  sharedSpending: number
  sharedBalance: number
  balanceHistory: BalanceHistoryItem[]
  transfers: Transfer[]
  sharedForm: { amount: string; note: string }
  setSharedForm: React.Dispatch<React.SetStateAction<{ amount: string; note: string }>>
  onReload: () => void
  onSubmitShared: (e: React.FormEvent) => void
  onDeleteTransfer: (id: string) => void
  onDeleteShared: () => void
}

export function SharedScreen({
  members,
  year,
  setYear,
  month,
  setMonth,
  busy,
  loading,
  recommendedTransferTotal,
  transfersSummary,
  sharedSpending,
  sharedBalance,
  balanceHistory,
  transfers,
  sharedForm,
  setSharedForm,
  onReload,
  onSubmitShared,
  onDeleteTransfer,
  onDeleteShared,
}: Props) {
  return (
    <div className="stack">
      <FilterBar
        showMembers={false}
        year={year}
        setYear={setYear}
        month={month}
        setMonth={setMonth}
        onReload={onReload}
        busy={busy || loading}
      />
      <Card title="共通口座サマリ" subtitle="必要額・実績・支出">
        <div className="summary-grid">
          <SummaryRow label="必要振込額（夫婦合計）" value={recommendedTransferTotal} />
          <SummaryRow label="実績振込（合計）" value={transfersSummary.total || 0} />
          <SummaryRow label="共通口座支出" value={sharedSpending} sign="-" />
          <SummaryRow label="口座収支" value={sharedBalance} />
        </div>
      </Card>

      <Card title="月次支出を登録" subtitle="共通口座からの支出を記録">
        <form className="form" onSubmit={onSubmitShared}>
          <label>
            支出額（円・0以上）
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={sharedForm.amount}
              onChange={(e) => setSharedForm({ ...sharedForm, amount: e.target.value })}
            />
          </label>
          <label>
            メモ（任意）
            <input
              type="text"
              value={sharedForm.note}
              onChange={(e) => setSharedForm({ ...sharedForm, note: e.target.value })}
              placeholder="内訳メモなど"
            />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? '送信中…' : '支出を登録'}
            </button>
            <button type="button" className="ghost" onClick={() => setSharedForm({ amount: '', note: '' })} disabled={busy}>
              リセット
            </button>
            <button type="button" className="ghost danger-text" onClick={onDeleteShared} disabled={busy}>
              支出を削除
            </button>
          </div>
        </form>
      </Card>

      <Card title="当月の振込一覧" subtitle="削除して差し替え可能">
        <div className="list">
          {transfers.length === 0 && <p className="muted">当月の振込記録はありません</p>}
          {transfers.map((t) => (
            <div key={t.id} className="list-item">
              <div>
                <p className="label">{members.find((m) => m.id === t.member_id)?.label || t.member_id}</p>
                <p className="muted">{t.note || '-'}</p>
              </div>
              <div className="list-actions">
                <span className="amount">{t.amount.toLocaleString()}円</span>
                <button className="ghost danger-text" onClick={() => onDeleteTransfer(t.id)} disabled={busy}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="共通口座 収支の推移" subtitle="入金-支出の差分を確認">
        <Suspense fallback={<div className="muted">チャートを読み込み中…</div>}>
          <BalanceChart data={balanceHistory} />
        </Suspense>
      </Card>
    </div>
  )
}
