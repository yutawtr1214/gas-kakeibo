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

export function BirdIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none" {...props}>
      <path d="M21.54 6.18c.01.18.01.37.01.55 0 5.61-4.27 12.08-12.08 12.08-2.4 0-4.63-.7-6.51-1.91a8.53 8.53 0 0 0 6.28-1.76 4.27 4.27 0 0 1-3.98-2.96c.64.1 1.22.1 1.9-.08a4.26 4.26 0 0 1-3.42-4.18v-.06c.57.32 1.23.51 1.93.53a4.25 4.25 0 0 1-1.9-3.54c0-.79.22-1.48.6-2.1a12.09 12.09 0 0 0 8.77 4.45 4.26 4.26 0 0 1 7.26-3.88 8.4 8.4 0 0 0 2.7-1.03 4.24 4.24 0 0 1-1.87 2.35 8.49 8.49 0 0 0 2.45-.67 9.1 9.1 0 0 1-2.14 2.28Z" />
    </svg>
  )
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...baseProps} {...props}>
      <path d="M6.5 8.5h11" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 5.5h6l-.4-1.4a1 1 0 0 0-.96-.7h-3.3a1 1 0 0 0-.96.7L9 5.5Z" />
      <path d="M7.5 8.5 8 19a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 16 19l.5-10.5" />
    </svg>
  )
}
