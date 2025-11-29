import type { SVGProps } from 'react'

const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <path d="M4 11.5 12 4l8 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 19v-3.5h-4V19a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 4 18.5z" />
    </svg>
  )
}

export function CalculatorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <rect x="6.5" y="3.5" width="11" height="17" rx="2" />
      <path d="M10 7.5h4M9.5 11.5h.01M12 11.5h.01M14.5 11.5h.01M9.5 14.5h.01M12 14.5h.01M14.5 14.5h.01M9.5 17h5" />
    </svg>
  )
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <path d="m5 15.5 9.5-9.5 3 3L8 18.5 5 19.5z" />
      <path d="M14.5 6l3 3" />
    </svg>
  )
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <path d="M9 10.5v-2.4a3 3 0 1 1 6 0v2.4" />
      <rect x="6.5" y="10.5" width="11" height="9" rx="1.8" />
      <path d="M12 14.5v2.4" />
      <circle cx="12" cy="14.4" r=".4" />
    </svg>
  )
}

export function HandshakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <path d="M4.5 12.6 8.6 9.5c.45-.34 1.08-.34 1.52 0l1.35 1.1c.42.34 1.03.35 1.47.03l1.48-1.07c.45-.33 1.07-.28 1.48.1l3.6 3.3" />
      <path d="M5.5 13.8 7.9 16c.55.53 1.4.56 2 .08l.9-.66" />
      <path d="M13.5 13.5l1.9 1.6c.58.48 1.43.48 2.01-.02l1.59-1.36" />
    </svg>
  )
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function HamburgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  )
}
