'use client'

import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShoppingCart, Zap, BarChart2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoginCardProps {
  title: string
  subtitle?: string
  onSubmit: (email: string, password: string) => Promise<void>
  error?: string
  loading?: boolean
  submitLabel?: string
}

const SITE_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'منصة الكاشير'

const FEATURES = [
  { icon: Zap,        label: 'نقطة بيع سريعة وسهلة الاستخدام' },
  { icon: BarChart2,  label: 'تقارير وتحليلات لحظية لمتجرك' },
  { icon: ShieldCheck,label: 'حماية وتشفير كامل لبياناتك' },
]

export default function LoginCard({
  title,
  subtitle,
  onSubmit,
  error,
  loading = false,
  submitLabel = 'تسجيل الدخول',
}: LoginCardProps) {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit(email, password)
  }

  return (
    <div className="min-h-screen flex" dir="rtl" style={{ background: 'var(--diamond)' }}>
      {/* لوحة الهوية البصرية */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 relative overflow-hidden px-12 py-14"
        style={{ background: 'var(--mirage)' }}
      >
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '9999px', background: 'var(--indigo)', opacity: 0.25, filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: '280px', height: '280px', borderRadius: '9999px', background: 'var(--blue)', opacity: 0.2, filter: 'blur(90px)' }} />

        <div style={{ position: 'relative', zIndex: 1 }} className="flex items-center gap-3">
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'linear-gradient(135deg,var(--indigo),var(--blue))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--sh-l)',
          }}>
            <ShoppingCart size={22} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>{SITE_NAME}</span>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: 700, lineHeight: 1.4, marginBottom: '10px' }}>
            إدارة متجرك بكل سهولة واحترافية
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '28px' }}>
            نظام كاشير متكامل للمبيعات والمخزون والتقارير في مكان واحد
          </p>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div style={{
                  width: '32px', height: '32px', borderRadius: '9px',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={15} color="#fff" />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13.5px' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
          © {new Date().getFullYear()} {SITE_NAME} — جميع الحقوق محفوظة
        </p>
      </div>

      {/* لوحة النموذج */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* شعار الجوال */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg,var(--indigo),var(--blue))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingCart size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{SITE_NAME}</span>
          </div>

          <div
            className="w-full space-y-6 p-8 rounded-2xl"
            style={{ background: 'var(--white)', border: '1px solid var(--border-color)', boxShadow: 'var(--sh-l)' }}
          >
            <div className="text-center">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
              {subtitle && (
                <p className="mt-1 text-sm" style={{ color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>
                  {subtitle}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                  البريد الإلكتروني
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    dir="ltr"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
                    style={{ background: 'var(--white)', border: '1px solid var(--border-color)', color: 'var(--text)', paddingRight: '36px', paddingLeft: '12px', textAlign: 'right' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--indigo-g)' }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                  كلمة المرور
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
                    style={{ background: 'var(--white)', border: '1px solid var(--border-color)', color: 'var(--text)', paddingRight: '36px', paddingLeft: '36px', textAlign: 'right' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--indigo)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--indigo-g)' }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                  style={{ background: 'var(--red-bg)', color: 'var(--red)' }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جارٍ الدخول...
                  </>
                ) : submitLabel}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
