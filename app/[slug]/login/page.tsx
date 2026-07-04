'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { signIn, SessionProvider } from 'next-auth/react'
import LoginCard from '@/components/shared/LoginCard'

function StoreLoginForm() {
  const router           = useRouter()
  const { slug }         = useParams<{ slug: string }>()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(email: string, password: string) {
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      slug,
      redirect: false,
    })

    setLoading(false)

    if (result?.error === 'LOCKED') {
      setError('الحساب مقفل مؤقتاً بسبب محاولات دخول متعددة. حاول بعد 15 دقيقة.')
    } else if (result?.error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
    } else {
      router.push(`/${slug}/pos`)
    }
  }

  return (
    <LoginCard
      title="تسجيل الدخول"
      subtitle={slug}
      onSubmit={handleSubmit}
      error={error}
      loading={loading}
      submitLabel="دخول"
    />
  )
}

export default function StoreLoginPage() {
  return (
    <SessionProvider basePath="/api/store-auth">
      <StoreLoginForm />
    </SessionProvider>
  )
}
