import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type IconColor = 'amber' | 'red' | 'blue' | 'orange'

const COLOR_MAP: Record<IconColor, { bg: string; fg: string }> = {
  amber:  { bg: 'var(--amber-bg)',  fg: 'var(--amber)' },
  red:    { bg: 'var(--red-bg)',    fg: 'var(--red)' },
  blue:   { bg: 'var(--blue-bg)',   fg: 'var(--info)' },
  orange: { bg: 'var(--orange-bg)', fg: 'var(--orange)' },
}

interface ActionButton {
  label: string
  href?: string
  onClick?: () => void
}

interface StatusPageProps {
  icon: LucideIcon
  iconColor: IconColor
  title: string
  description: string
  extra?: ReactNode
  actionButton?: ActionButton
}

export function StatusPage({ icon: Icon, iconColor, title, description, extra, actionButton }: StatusPageProps) {
  const { bg, fg } = COLOR_MAP[iconColor]

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--diamond)' }} dir="rtl">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: bg }}>
            <Icon className="w-10 h-10" style={{ color: fg }} />
          </div>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
        <p className="text-base" style={{ color: 'var(--text-2)' }}>{description}</p>
        {extra}
        {actionButton && (
          actionButton.href ? (
            <a
              href={actionButton.href}
              className="inline-block mt-2 px-5 py-2.5 rounded-md text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--cerulean)' }}
            >
              {actionButton.label}
            </a>
          ) : (
            <button
              onClick={actionButton.onClick}
              className="inline-block mt-2 px-5 py-2.5 rounded-md text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--cerulean)' }}
            >
              {actionButton.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
