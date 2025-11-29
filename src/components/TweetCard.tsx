import { renderAvatar } from './renderAvatar'

type Action = {
  key: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  tone?: 'primary' | 'danger' | 'muted'
  disabled?: boolean
}

type Props = {
  members: { id: string; label: string; avatar?: string }[]
  memberId: string
  name: string
  handle: string
  headline: string
  meta?: string
  body?: string
  amountLabel?: string
  actions?: Action[]
  headerExtra?: React.ReactNode
}

export function TweetCard({
  members,
  memberId,
  name,
  handle,
  headline,
  meta,
  body,
  amountLabel,
  actions = [],
  headerExtra,
}: Props) {
  return (
    <div className="tweet-card">
      <div className="tweet-head">
        {renderAvatar(members, memberId, 42)}
        <div className="tweet-head__main">
          <div className="tweet-title">
            <span className="tweet-name">{name}</span>
            <span className="tweet-handle">@{handle}</span>
            <div className="tweet-spacer" />
            {headerExtra}
          </div>
          <div className="tweet-headline">{headline}</div>
          {meta && <div className="tweet-meta">{meta}</div>}
        </div>
      </div>

      <div className="tweet-main">
        {body && <div className="tweet-body">{body}</div>}

        <div className="tweet-footer">
          <div className="tweet-actions">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`tweet-action tone-${a.tone || 'primary'}`}
                onClick={a.onClick}
                disabled={a.disabled}
                aria-label={a.label}
                title={a.label}
              >
                {a.icon || a.label}
              </button>
            ))}
          </div>
          {amountLabel && <span className="tweet-amount">{amountLabel}</span>}
        </div>
      </div>
    </div>
  )
}
