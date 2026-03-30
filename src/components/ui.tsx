/**
 * Minimal shared UI primitives — no external library dependency.
 */
import React from 'react'

// ── Badge ─────────────────────────────────────────────────────────────────────

const badgeConfig: Record<string, { cls: string; uz: string }> = {
  QUEUED:       { cls: 'bg-slate-700 text-slate-300',   uz: 'Navbatda' },
  CRAWLING:     { cls: 'bg-blue-900 text-blue-300 pulse', uz: 'Crawl qilinmoqda' },
  PAUSED:       { cls: 'bg-yellow-900 text-yellow-300', uz: 'To\'xtatilgan' },
  DONE:         { cls: 'bg-green-900 text-green-300',   uz: 'Tugadi' },
  ERROR:        { cls: 'bg-red-900 text-red-300',       uz: 'Xatolik' },
  SKIPPED:      { cls: 'bg-slate-800 text-slate-500',   uz: 'O\'tkazildi' },
  FOR_SALE:     { cls: 'bg-emerald-900 text-emerald-300', uz: 'Sotuvda' },
  AVAILABLE:    { cls: 'bg-teal-900 text-teal-300',     uz: 'Ro\'yxatdan o\'tmagan' },
  NOT_FOR_SALE: { cls: 'bg-slate-700 text-slate-400',   uz: 'Sotuvda emas' },
  UNKNOWN:      { cls: 'bg-slate-800 text-slate-500',   uz: 'Noma\'lum' },
  CHECKING:     { cls: 'bg-blue-900 text-blue-300 pulse', uz: 'Tekshirilmoqda' },
  INFO:         { cls: 'bg-slate-700 text-slate-300',   uz: 'INFO' },
  WARN:         { cls: 'bg-yellow-900 text-yellow-300', uz: 'OGOHLANTIRISH' },
  WARNING:      { cls: 'bg-yellow-900 text-yellow-300', uz: 'OGOHLANTIRISH' },
  DEBUG:        { cls: 'bg-slate-800 text-slate-500',   uz: 'DEBUG' },
}

export function Badge({ label }: { label: string }) {
  const config = badgeConfig[label]
  const cls = config?.cls ?? 'bg-slate-700 text-slate-300'
  const text = config?.uz ?? label
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {text}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

const btnVariants = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
  danger: 'bg-red-700 hover:bg-red-600 text-white',
  ghost: 'hover:bg-slate-800 text-slate-400 hover:text-slate-200',
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = `inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'}`
  return (
    <button className={`${base} ${btnVariants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-[#1a1d27] border border-[#2a2d3e] rounded-lg ${className}`}>
      {children}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-[#1a1d27] border border-[#2a2d3e] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${props.className ?? ''}`}
    />
  )
}

// ── Select ────────────────────────────────────────────────────────────────────

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-[#1a1d27] border border-[#2a2d3e] rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 ${props.className ?? ''}`}
    />
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2d3e]">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="animate-spin"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
