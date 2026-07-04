import { NextResponse } from 'next/server'
import { getHealthSnapshot } from '@/lib/system-metrics'

// فحص صحة عام بلا مصادقة — لا يُعيد أي معلومة حساسة (بلا أسماء متاجر/مستخدمين/بيانات مالية)
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getHealthSnapshot())
}
