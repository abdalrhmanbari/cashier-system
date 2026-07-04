'use client'

import { useEffect, useState } from 'react'
import {
  Plus, ToggleLeft, ToggleRight,
  ShoppingCart, Store, Coffee, Utensils, ChefHat,
  Shirt, Pill, Scissors, Wrench, BookOpen, Zap,
  Smartphone, Truck, Dumbbell, Gem, Home, Car,
  Baby, PawPrint, Flower2, Laptop, Watch, Glasses,
  type LucideIcon,
} from 'lucide-react'
import { SAInput } from '@/components/shared/SAInput'
import { Button } from '@/components/ui/button'

const STORE_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: 'ShoppingCart', label: 'بقالة',    Icon: ShoppingCart },
  { name: 'Store',        label: 'متجر',      Icon: Store        },
  { name: 'Coffee',       label: 'مقهى',      Icon: Coffee       },
  { name: 'Utensils',     label: 'مطعم',      Icon: Utensils     },
  { name: 'ChefHat',      label: 'طعام',      Icon: ChefHat      },
  { name: 'Shirt',        label: 'ملابس',     Icon: Shirt        },
  { name: 'Pill',         label: 'صيدلية',    Icon: Pill         },
  { name: 'Scissors',     label: 'حلاق',      Icon: Scissors     },
  { name: 'Wrench',       label: 'ورشة',      Icon: Wrench       },
  { name: 'BookOpen',     label: 'مكتبة',     Icon: BookOpen     },
  { name: 'Zap',          label: 'كهربائيات', Icon: Zap          },
  { name: 'Smartphone',   label: 'هواتف',     Icon: Smartphone   },
  { name: 'Laptop',       label: 'حاسوب',     Icon: Laptop       },
  { name: 'Truck',        label: 'شحن',       Icon: Truck        },
  { name: 'Dumbbell',     label: 'رياضة',     Icon: Dumbbell     },
  { name: 'Gem',          label: 'مجوهرات',   Icon: Gem          },
  { name: 'Watch',        label: 'ساعات',     Icon: Watch        },
  { name: 'Glasses',      label: 'بصريات',    Icon: Glasses      },
  { name: 'Home',         label: 'عقارات',    Icon: Home         },
  { name: 'Car',          label: 'سيارات',    Icon: Car          },
  { name: 'Baby',         label: 'أطفال',     Icon: Baby         },
  { name: 'PawPrint',     label: 'حيوانات',   Icon: PawPrint     },
  { name: 'Flower2',      label: 'زهور',      Icon: Flower2      },
]

const iconMap = Object.fromEntries(STORE_ICONS.map(s => [s.name, s.Icon])) as Record<string, LucideIcon>

function StoreIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = iconMap[name] ?? Store
  return <Icon className={className} style={style} />
}

type StoreType = { id: string; name: string; icon: string; description: string | null; isActive: boolean }

export default function StoreTypesPage() {
  const [items,    setItems]    = useState<StoreType[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', icon: 'Store', description: '' })
  const [saving,   setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/super-admin/store-types')
    setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(id: string, current: boolean) {
    await fetch('/api/super-admin/store-types', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !current }),
    })
    setItems(s => s.map(t => t.id === id ? { ...t, isActive: !current } : t))
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/super-admin/store-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', icon: 'Store', description: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">أنواع المتاجر</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} />
          نوع جديد
        </Button>
      </div>

      {showForm && (
        <form onSubmit={add} className="p-4 rounded-xl space-y-4" style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>الاسم</label>
              <SAInput
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
                placeholder="سوبر ماركت"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>الوصف</label>
              <SAInput
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="مواد غذائية"
              />
            </div>
            <Button type="submit" disabled={saving} className="shrink-0">
              {saving ? '...' : 'إضافة'}
            </Button>
          </div>

          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--text-2)' }}>الأيقونة</label>
            {/* Icon picker — kept as raw buttons due to dynamic selected state styling */}
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
              {STORE_ICONS.map(({ name, label, Icon }) => (
                <button
                  key={name}
                  type="button"
                  title={label}
                  onClick={() => setForm(p => ({ ...p, icon: name }))}
                  className="flex flex-col items-center gap-1 p-2 rounded-md text-xs transition-colors"
                  style={form.icon === name
                    ? { border: '1px solid var(--cerulean)', background: 'var(--cerulean-g)', color: 'var(--cerulean)' }
                    : { border: '1px solid var(--border-color)', color: 'var(--text-2)' }
                  }
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-m)' }}>
              المختار: <span style={{ color: 'var(--text)' }}>{STORE_ICONS.find(s => s.name === form.icon)?.label ?? form.icon}</span>
            </p>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-m)' }}>جارٍ التحميل...</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'var(--white)', border: '1px solid var(--border-color)' }}
            >
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                style={{ background: 'var(--cerulean-g)' }}
              >
                <StoreIcon name={t.icon} className="w-5 h-5" style={{ color: 'var(--cerulean)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t.name}</p>
                {t.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{t.description}</p>}
              </div>
              {/* Toggle — kept as raw button due to contextual color */}
              <button
                onClick={() => toggle(t.id, t.isActive)}
                className="flex items-center gap-1.5 text-xs transition-colors shrink-0"
                style={{ color: t.isActive ? 'var(--green)' : 'var(--text-m)' }}
              >
                {t.isActive ? <><ToggleRight size={18} /> مفعّل</> : <><ToggleLeft size={18} /> معطّل</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
