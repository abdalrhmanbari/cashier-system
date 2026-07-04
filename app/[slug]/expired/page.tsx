import { CalendarX } from 'lucide-react'

export default function ExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--diamond)' }} dir="rtl">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--red-bg)' }}>
            <CalendarX className="w-10 h-10" style={{ color: 'var(--red)' }} />
          </div>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>انتهى الاشتراك</h1>
        <p className="text-base" style={{ color: 'var(--text-2)' }}>
          انتهت صلاحية اشتراك هذا المتجر. يرجى تجديد الاشتراك للمتابعة.
        </p>
      </div>
    </div>
  )
}
