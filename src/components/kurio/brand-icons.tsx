/** Ícones de marcas (lucide 1.x removeu ícones de marcas). Decorativos. */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export const Facebook = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H8.3v3.2h2.6V22H14v-10.3h2.6l.4-3.2H14Z" />
  </svg>
)
export const Instagram = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
)
export const Linkedin = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm7 0h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6v5.4h-4v-4.8c0-1.2 0-2.7-1.6-2.7-1.7 0-2 1.3-2 2.6v4.9h-4v-11Z" />
  </svg>
)
export const Twitter = (p: P) => (
  <svg {...base} {...p}>
    <path d="M22 5.9c-.7.3-1.5.6-2.4.7a4.2 4.2 0 0 0 1.8-2.3c-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.8A11.7 11.7 0 0 1 3.4 4.8a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.9.1a4.1 4.1 0 0 0 3.9 2.9A8.3 8.3 0 0 1 2 18.6 11.7 11.7 0 0 0 8.3 20.4c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.3Z" />
  </svg>
)
export const Youtube = (p: P) => (
  <svg {...base} {...p}>
    <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1-3.2-.5-4.8ZM9.8 15.1V8.9l5.7 3.1-5.7 3.1Z" />
  </svg>
)
