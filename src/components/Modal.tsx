type Props = {
  open: boolean
  type: 'success' | 'error'
  title?: string
  message: string
  onClose: () => void
}

export function Modal({ open, type, title, message, onClose }: Props) {
  if (!open) return null
  const heading = title || (type === 'success' ? '完了' : 'エラー')
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`modal ${type}`}>
        <h3>{heading}</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          {message}
        </p>
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button className="primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
