export function renderAvatar(
  members: { id: string; label: string; avatar?: string }[],
  memberId: string,
  size = 40,
) {
  const m = members.find((x) => x.id === memberId)
  const fallback = (m?.label || memberId || '?').slice(0, 1)
  if (m?.avatar) {
    return (
      <img
        src={m.avatar}
        alt={`${m.label || memberId} avatar`}
        className="avatar"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div className="avatar avatar--placeholder" style={{ width: size, height: size }}>
      {fallback}
    </div>
  )
}
