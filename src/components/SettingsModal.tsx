import type React from 'react'

type Props = {
  open: boolean
  husband: string
  wife: string
  setHusband: (v: string) => void
  setWife: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  busy: boolean
}

export function SettingsModal({ open, husband, wife, setHusband, setWife, onSubmit, onClose, busy }: Props) {
  if (!open) return null
  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>設定</h3>
          <button className="ghost small" onClick={onClose}>
            閉じる
          </button>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label>
            夫の名前（5文字以内）
            <input
              type="text"
              value={husband}
              maxLength={5}
              onChange={(e) => setHusband(e.target.value)}
              placeholder="例: 太郎"
            />
          </label>
          <label>
            妻の名前（5文字以内）
            <input
              type="text"
              value={wife}
              maxLength={5}
              onChange={(e) => setWife(e.target.value)}
              placeholder="例: 花子"
            />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? '送信中…' : '保存する'}
            </button>
            <button type="button" className="ghost" onClick={onClose} disabled={busy}>
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.35)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  width: '90%',
  maxWidth: 420,
  boxShadow: '0 12px 24px rgba(15,23,42,0.15)',
}
