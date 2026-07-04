'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function ErrorsChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} style={{ direction: 'ltr' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-l)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-m)' }} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-m)' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}
          formatter={(v: number) => [v, 'أخطاء']}
        />
        <Bar dataKey="count" fill="var(--red)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
