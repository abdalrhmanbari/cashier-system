'use client'

import { useState } from 'react'
import { Search, Download, ChevronRight, ChevronLeft } from 'lucide-react'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchKeys?: (keyof T)[]
  exportable?: boolean
  exportFilename?: string
  pageSize?: number
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  actions?: (row: T) => React.ReactNode
  actionsLabel?: string
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = true,
  searchKeys = [],
  exportable = false,
  exportFilename = 'export',
  pageSize = 15,
  loading = false,
  emptyMessage = 'لا توجد بيانات',
  emptyIcon,
  actions,
  actionsLabel = 'إجراءات',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const filtered = search
    ? data.filter(row => searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(search.toLowerCase())))
    : data

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

  function exportCSV() {
    const headers = columns.map(c => c.label).join(',')
    const rows    = data.map(row => columns.map(c => `"${String(row[c.key as keyof T] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob    = new Blob(['﻿' + [headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a       = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${exportFilename}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const colSpan = columns.length + (actions ? 1 : 0)

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || exportable) && (
        <div className="flex items-center gap-2 flex-wrap">
          {searchable && (
            <div className="relative flex-1 w-full sm:w-auto sm:max-w-xs">
              <Search size={14} style={{ position:'absolute', right:'9px', top:'50%', transform:'translateY(-50%)', color:'var(--text-m)', pointerEvents:'none' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="بحث..."
                className="field"
                style={{ paddingRight: '30px', paddingTop: '6px', paddingBottom: '6px', fontSize: '13px' }}
              />
            </div>
          )}
          {exportable && (
            <button onClick={exportCSV} className="btn-outline" style={{ fontSize:'13px', padding:'5px 12px' }}>
              <Download size={13} /> تصدير CSV
            </button>
          )}
          <span style={{ color:'var(--text-m)', fontSize:'12px', marginRight:'auto' }}>{filtered.length} سجل</span>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden" style={{ borderRadius:'var(--r)' }}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={String(col.key)} className={col.className} style={{ textAlign: col.align ?? 'right' }}>
                    {col.label}
                  </th>
                ))}
                {actions && <th style={{ textAlign:'right' }}>{actionsLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: colSpan }).map((_, j) => (
                      <td key={j}>
                        <div style={{ height:'14px', borderRadius:'4px', background:'var(--diamond)', animation:'pulse 1.5s infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} style={{ padding:'48px 0', textAlign:'center' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
                      {emptyIcon && <div style={{ color:'var(--text-m)', marginBottom:'4px' }}>{emptyIcon}</div>}
                      <span style={{ color:'var(--text-m)', fontSize:'13px' }}>{emptyMessage}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td key={String(col.key)} className={col.className} style={{ textAlign: col.align ?? 'right' }}>
                        {col.render ? col.render(row[col.key as keyof T], row) : String(row[col.key as keyof T] ?? '—')}
                      </td>
                    ))}
                    {actions && <td><div style={{ display:'flex', alignItems:'center', gap:'4px' }}>{actions(row)}</div></td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'12px', color:'var(--text-m)' }}>صفحة {page} من {totalPages}</span>
          <div style={{ display:'flex', gap:'4px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
              style={{ width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'var(--r-x)', border:'1px solid var(--border-color)', background:'var(--white)', cursor:'pointer', opacity: page===1 ? .4 : 1 }}
            ><ChevronRight size={13} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i+1).map(p => (
              <button
                key={p} onClick={() => setPage(p)}
                style={{ width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'var(--r-x)', border:'1px solid var(--border-color)', background: page===p ? 'var(--indigo)' : 'var(--white)', color: page===p ? '#fff' : 'var(--text)', cursor:'pointer', fontSize:'12px', fontWeight: page===p ? 600 : 400 }}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
              style={{ width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'var(--r-x)', border:'1px solid var(--border-color)', background:'var(--white)', cursor:'pointer', opacity: page===totalPages ? .4 : 1 }}
            ><ChevronLeft size={13} /></button>
          </div>
        </div>
      )}
    </div>
  )
}