import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// StatusBadge — colour-coded run / step status
// ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'bg-zinc-100  text-zinc-600  dark:bg-zinc-800  dark:text-zinc-400',
  QUEUED:    'bg-blue-100  text-blue-700  dark:bg-blue-900  dark:text-blue-300',
  RUNNING:   'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  SUCCESS:   'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  FAILED:    'bg-red-100   text-red-700   dark:bg-red-900   dark:text-red-300',
  CANCELLED: 'bg-zinc-100  text-zinc-500  dark:bg-zinc-800  dark:text-zinc-400',
  SKIPPED:   'bg-zinc-100  text-zinc-400  dark:bg-zinc-800  dark:text-zinc-500',
}

const STATUS_DOT: Record<string, string> = {
  PENDING:   'bg-zinc-400',
  QUEUED:    'bg-blue-500',
  RUNNING:   'bg-amber-500 animate-pulse-fast',
  SUCCESS:   'bg-green-500',
  FAILED:    'bg-red-500',
  CANCELLED: 'bg-zinc-400',
  SKIPPED:   'bg-zinc-300',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOT[status])} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={clsx('animate-spin text-zinc-400', className)} />
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  padding = true,
}: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl',
        padding && 'p-5',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

export function Empty({ title, description, action }: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <span className="text-2xl">📭</span>
      </div>
      <p className="font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      {description && (
        <p className="text-sm text-zinc-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white border-transparent',
  secondary: 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  danger:    'bg-red-600 hover:bg-red-700 text-white border-transparent',
  ghost:     'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-transparent',
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}) {
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg border font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        sizes[size],
        className
      )}
    >
      {loading && <Spinner size={13} />}
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Duration formatter
// ─────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

export function durationMs(start?: Date | string | null, end?: Date | string | null): number | null {
  if (!start) return null
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  return e - s
}