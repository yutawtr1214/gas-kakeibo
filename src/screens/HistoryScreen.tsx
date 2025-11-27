import React from 'react'
import type { Item, ItemType } from '../lib/api/types'
import { Card } from '../components/Card'

type Props = {
  items: Item[]
  busy: boolean
  typeLabel: (t: ItemType) => string
  isRecurrentItem: (item: Item) => boolean
  onDeleteItem: (id: string) => void
}

export function HistoryScreen({ items, busy, typeLabel, isRecurrentItem, onDeleteItem }: Props) {
  return (
    <div className="grid">
      <Card title="イベント一覧" subtitle="入力内容の確認・削除">
        <div className="list">
          {items.length === 0 && <p className="muted">データがありません</p>}
          {items.map((item) => (
            <div key={item.id} className="list-item">
              <div>
                <p className="label">
                  {item.date || '-'} / {typeLabel(item.item_type)}
                  {isRecurrentItem(item) && <span className="chip muted" style={{ marginLeft: 8 }}>固定費</span>}
                </p>
                <p className="muted">{item.note || '-'}</p>
              </div>
              <div className="list-actions">
                <span className="amount">{item.amount.toLocaleString()}円</span>
                <button className="ghost danger-text" onClick={() => onDeleteItem(item.id)} disabled={busy}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
