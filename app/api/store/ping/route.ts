import { NextResponse } from 'next/server'

// فحص اتصال خفيف بلا مصادقة أو قاعدة بيانات — يُستخدم فقط للتأكد من وصول الطلبات إلى السيرفر
export const dynamic = 'force-dynamic'

export async function GET() {
  return new NextResponse(null, { status: 200 })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
