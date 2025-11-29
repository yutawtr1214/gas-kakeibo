import type { Item, ItemType, Summary, TransfersResult } from '../lib/api/types'
import { Card } from '../components/Card'
import { SummaryRow } from '../components/SummaryRow'
import { FilterBar } from '../components/FilterBar'
import { TweetCard } from '../components/TweetCard'
import { TrashIcon } from '../components/icons'

type Member = { id: string; label: string; avatar?: string }

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
  summary: Summary
  transfersSummary: TransfersResult
  items: Item[]
  typeLabel: (t: ItemType) => string
  isRecurrentItem: (item: Item) => boolean
  onReload: () => void
  onQuickTransfer: () => void
  onDeleteItem: (id: string) => void
  onGoShared: () => void
}

export function PlanScreen({
  members,
  memberId,
  setMemberId,
  year,
  setYear,
  month,
  setMonth,
  busy,
  loading,
  summary,
  transfersSummary,
  items,
  typeLabel,
  isRecurrentItem,
  onReload,
  onQuickTransfer,
  onDeleteItem,
  onGoShared,
}: Props) {
  return (
    <div className="stack">
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
      <Card
        title="今月の必要振込額"
        subtitle={`${year}年${month}月 / ${members.find((m) => m.id === memberId)?.label || ''}`}
        highlight
      >
        <div className="summary-grid">
          <SummaryRow label="必要振込額" value={summary.recommended_transfer} />
          <SummaryRow label="実績振込（このメンバー）" value={transfersSummary.by_member[memberId] || 0} />
          <SummaryRow
            label="残り振込必要額"
            value={summary.recommended_transfer - (transfersSummary.by_member[memberId] || 0)}
          />
        </div>
        <div className="actions">
          <button className="primary" onClick={onQuickTransfer} disabled={busy || summary.recommended_transfer <= 0}>
            必要額で振込登録
          </button>
          <button className="ghost" onClick={onGoShared}>
            共有サマリを見る
          </button>
        </div>
      </Card>

      <Card title="計算の内訳" subtitle="この月の収支バランス">
        <div className="summary-grid">
          <SummaryRow label="収入合計" value={summary.income_total} />
          <SummaryRow label="個人口座で立て替え" value={summary.shared_from_personal_total} sign="-" />
          <SummaryRow label="共有口座から前借り" value={summary.personal_from_shared_total} sign="+" />
          <SummaryRow label="お小遣い合計" value={summary.pocket_total} sign="-" />
        </div>
      </Card>

              <Card title="当月の履歴" subtitle="計算に含まれる明細（全件表示）">
                <div className="list">
                      {items.length === 0 && <p className="muted">当月のデータがありません</p>}
                      {items.map((item) => (
                        <div key={item.id}>
                          <TweetCard
                            members={members}
                            memberId={item.member_id}
                            name={members.find((m) => m.id === item.member_id)?.label || item.member_id}
                            handle={item.member_id}
                            headline={`${item.date || '-'} / ${typeLabel(item.item_type)}`}
                            body={item.note || ''}
                            amountLabel={`${item.amount.toLocaleString()}円`}
                            actions={
                              !isRecurrentItem(item)
                                ? [
                                    {
                                      key: 'delete',
                                      label: '削除',
                                      icon: <TrashIcon width={18} height={18} />,
                                      onClick: () => onDeleteItem(item.id),
                                      tone: 'danger',
                                      disabled: busy,
                                    },
                                  ]
                                : []
                            }
                          />
                        </div>
                      ))}
                    </div>
              </Card>
    </div>
  )
}
