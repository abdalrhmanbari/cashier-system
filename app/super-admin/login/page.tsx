'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, SessionProvider } from 'next-auth/react'
import LoginCard from '@/components/shared/LoginCard'

function SuperAdminLoginForm() {
  const router = useRouter()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(email: string, password: string) {
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/super-admin',
    })

    setLoading(false)

    if (result?.error) {
      setError('بيانات الدخول غير صحيحة')
    } else {
      router.push('/super-admin')
    }
  }

  return (
    <LoginCard
      title="لوحة تحكم المنصة"
      subtitle="Super Admin"
      onSubmit={handleSubmit}
      error={error}
      loading={loading}
    />
  )
}

export default function SuperAdminLoginPage() {
  return (
    <SessionProvider basePath="/api/super-admin-auth">
      <SuperAdminLoginForm />
    </SessionProvider>
  )
}
