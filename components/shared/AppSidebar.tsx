'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  ShoppingCart, Package, Clock, Users, Truck, BarChart2, Settings,
  LayoutDashboard, Store, CreditCard, BadgeDollarSign, Tag,
  Building2, LogOut, ShieldCheck, MoreHorizontal, X, Wallet, Undo2, Boxes, Wrench,
  Activity, FileWarning, HeartPulse, MessageCircle,
} from 'lucide-react'

const WHATSAPP_CONTACT_URL = 'https://wa.me/963982050174'

type Role = 'SUPER_ADMIN' | 'STORE_MANAGER' | 'CASHIER'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  /** يُعرض كعنوان قسم قبل هذا العنصر إن اختلف عن قسم العنصر السابق (السوبر أدمن فقط حالياً) */
  section?: string
  /** رابط خارجي (لا يُضاف إليه بادئة المتجر ويُفتح في تبويب جديد) */
  external?: boolean
}

interface AppSidebarProps {
  role: Role
  userName: string
  slug?: string
  storeName?: string
}

const SUPER_ADMIN_NAV: NavItem[] = [
  { href: '/super-admin',               label: 'لوحة التحكم',    icon: LayoutDashboard, exact: true },
  { href: '/super-admin/stores',        label: 'المتاجر',         icon: Store            },
  { href: '/super-admin/subscriptions', label: 'الاشتراكات',      icon: CreditCard       },
  { href: '/super-admin/plans',         label: 'الخطط والأسعار',  icon: BadgeDollarSign  },
  { href: '/super-admin/store-types',   label: 'أنواع المتاجر',   icon: Tag              },
  { href: '/super-admin/users',         label: 'المستخدمون',      icon: Users            },
  { href: '/super-admin/maintenance',        label: 'الصيانة',        icon: Wrench,     section: 'النظام' },
  { href: '/super-admin/system/monitoring',  label: 'المراقبة',       icon: Activity,   section: 'النظام' },
  { href: '/super-admin/system/errors',      label: 'سجل الأخطاء',    icon: FileWarning, section: 'النظام' },
  { href: '/super-admin/system/health',      label: 'الصحة',          icon: HeartPulse, section: 'النظام' },
]

const MANAGER_NAV: NavItem[] = [
  { href: '/pos',       label: 'نقطة البيع', icon: ShoppingCart, exact: true },
  { href: '/shifts',    label: 'الورديات',    icon: Clock        },
  { href: '/products',  label: 'المنتجات',    icon: Package      },
  { href: '/inventory', label: 'المخزون',     icon: Boxes        },
  { href: '/returns',   label: 'المرتجعات',   icon: Undo2        },
  { href: '/customers', label: 'العملاء',     icon: Users        },
  { href: '/suppliers', label: 'الموردون',    icon: Truck        },
  { href: '/expenses',  label: 'المصاريف',    icon: Wallet       },
  { href: '/reports',   label: 'التقارير',    icon: BarChart2    },
  { href: '/settings',  label: 'الإعدادات',   icon: Settings     },
  { href: WHATSAPP_CONTACT_URL, label: 'تواصل معنا', icon: MessageCircle, external: true },
]

const CASHIER_NAV: NavItem[] = [
  { href: '/pos',      label: 'نقطة البيع', icon: ShoppingCart, exact: true },
  { href: '/shifts',   label: 'الورديات',   icon: Clock        },
  { href: '/returns',  label: 'المرتجعات',  icon: Undo2        },
  { href: WHATSAPP_CONTACT_URL, label: 'تواصل معنا', icon: MessageCircle, external: true },
]

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN:   'مدير المنصة',
  STORE_MANAGER: 'مدير المتجر',
  CASHIER:       'كاشير',
}

export default function AppSidebar({ role, userName, slug, storeName }: AppSidebarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const navItems = role === 'SUPER_ADMIN' ? SUPER_ADMIN_NAV : role === 'STORE_MANAGER' ? MANAGER_NAV : CASHIER_NAV
  const resolve  = (item: NavItem) => item.external ? item.href : (role === 'SUPER_ADMIN' ? item.href : `/${slug}${item.href}`)

  const isActive = (item: NavItem) => {
    if (item.external) return false
    const full = resolve(item)
    return item.exact ? pathname === full : pathname === full || pathname.startsWith(`${full}/`)
  }

  const signOutUrl = role === 'SUPER_ADMIN' ? '/super-admin/login' : `/${slug}/login`

  const MOBILE_MAIN_COUNT = 4
  const mobileMain  = navItems.slice(0, MOBILE_MAIN_COUNT)
  const mobileMore  = navItems.slice(MOBILE_MAIN_COUNT)

  return (
    <>
    <aside
      className="hidden md:flex md:flex-col"
      style={{
        width: 'var(--sw)',
        flexShrink: 0,
        background: 'var(--mirage)',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        height: 'calc(100vh - var(--th))',
      }}
    >
      {/* Brand header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {role === 'SUPER_ADMIN' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={14} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginTop: '2px' }}>SUPER ADMIN</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={14} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{storeName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        {navItems.map((item, i) => {
          const active = isActive(item)
          const Icon   = item.icon
          const showSectionLabel = item.section && item.section !== navItems[i - 1]?.section
          return (
            <div key={item.href}>
            {showSectionLabel && (
              <p style={{
                fontSize: '10.5px', fontWeight: 600, color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                margin: i === 0 ? '4px 10px 6px' : '14px 10px 6px',
              }}>
                {item.section}
              </p>
            )}
            <Link
              href={resolve(item)}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '7px 10px',
                borderRadius: 'var(--r-x)',
                fontSize: '13.5px',
                fontWeight: active ? 500 : 400,
                textDecoration: 'none',
                marginBottom: '1px',
                transition: 'background .12s, color .12s',
                borderRight: active ? '2px solid #4f46e5' : '2px solid transparent',
                background: active ? 'rgba(79,70,229,0.15)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'rgba(255,255,255,0.06)'
                  el.style.color      = 'rgba(255,255,255,0.8)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'transparent'
                  el.style.color      = 'rgba(255,255,255,0.5)'
                }
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', marginBottom: '2px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '9999px', flexShrink: 0,
            background: 'rgba(79,70,229,0.25)', color: '#a5b4fc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700,
          }}>
            {userName.slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: signOutUrl })}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '6px 10px', borderRadius: 'var(--r-x)', border: 'none',
            background: 'transparent', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--f)',
            transition: 'background .12s, color .12s',
          }}
          onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(239,68,68,0.15)'; el.style.color = '#ef4444'; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <LogOut size={14} />
          تسجيل خروج
        </button>
      </div>
    </aside>

    {/* ═══ شريط تنقل سفلي — للجوال فقط ═══ */}
    {role !== 'SUPER_ADMIN' && (
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex"
        style={{
          height: '56px',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'var(--mirage)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {mobileMain.map(item => {
          const active = isActive(item)
          const Icon   = item.icon
          return (
            <Link
              key={item.href}
              href={resolve(item)}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '2px', textDecoration: 'none', fontSize: '10px',
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={18} style={{ color: active ? 'var(--indigo)' : undefined }} />
              {item.label}
            </Link>
          )
        })}
        {mobileMore.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '2px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '10px',
              color: mobileMore.some(isActive) ? '#fff' : 'rgba(255,255,255,0.45)',
              fontWeight: mobileMore.some(isActive) ? 600 : 400, fontFamily: 'var(--f)',
            }}
          >
            <MoreHorizontal size={18} style={{ color: mobileMore.some(isActive) ? 'var(--indigo)' : undefined }} />
            المزيد
          </button>
        )}
      </nav>
    )}

    {/* ═══ ورقة "المزيد" — للجوال فقط ═══ */}
    {moreOpen && (
      <div className="modal-backdrop md:hidden" dir="rtl" style={{ alignItems: 'flex-end' }} onClick={() => setMoreOpen(false)}>
        <div
          className="modal-box"
          style={{ maxWidth: '520px', background: 'var(--mirage)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>المزيد</span>
            <button onClick={() => setMoreOpen(false)} style={{ color: 'rgba(255,255,255,0.5)', border: 'none', background: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: '8px' }}>
            {mobileMore.map(item => {
              const active = isActive(item)
              const Icon   = item.icon
              return (
                <Link
                  key={item.href}
                  href={resolve(item)}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setMoreOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                    borderRadius: 'var(--r-x)', fontSize: '14px', textDecoration: 'none',
                    background: active ? 'rgba(79,70,229,0.15)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', marginBottom: '4px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '9999px', flexShrink: 0,
                background: 'rgba(79,70,229,0.25)', color: '#a5b4fc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
              }}>
                {userName.slice(0, 1)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{ROLE_LABEL[role]}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: signOutUrl })}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '8px 10px', borderRadius: 'var(--r-x)', border: 'none',
                background: 'transparent', color: '#ef4444', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'var(--f)',
              }}
            >
              <LogOut size={14} />
              تسجيل خروج
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}